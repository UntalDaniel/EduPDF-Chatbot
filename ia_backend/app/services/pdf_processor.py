# ia_backend/app/services/pdf_processor.py
import logging
import tempfile
import os
from typing import List, Dict, Any, Union, Optional

import fitz  # PyMuPDF
import httpx # Para descargar PDF desde URL
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from fastapi import HTTPException # Para errores HTTP

from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone as PineconeSdkClient

import firebase_admin
from firebase_admin import storage, firestore, credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Inicialización de Firebase Admin SDK ---
if not firebase_admin._apps:
    try:
        service_account_key_source = settings.FIREBASE_SERVICE_ACCOUNT_KEY
        if isinstance(service_account_key_source, str) and service_account_key_source.strip().startswith("{"):
            import json
            cred_obj = json.loads(service_account_key_source)
            cred = credentials.Certificate(cred_obj)
            logger.info("Initializing Firebase Admin SDK with JSON object from settings.")
        elif isinstance(service_account_key_source, str): # Path to file
            cred = credentials.Certificate(service_account_key_source)
            logger.info(f"Initializing Firebase Admin SDK with service account file: {service_account_key_source}")
        elif isinstance(service_account_key_source, dict): # Direct dict
            cred = credentials.Certificate(service_account_key_source)
            logger.info("Initializing Firebase Admin SDK with dictionary from settings.")
        else:
            raise ValueError("FIREBASE_SERVICE_ACCOUNT_KEY is not a valid type (string path, JSON string, or dict).")

        firebase_admin.initialize_app(cred, {
            'storageBucket': settings.FIREBASE_STORAGE_BUCKET
        })
        logger.info(f"Firebase Admin SDK initialized in pdf_processor. Storage bucket: {settings.FIREBASE_STORAGE_BUCKET}")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK in pdf_processor: {e}", exc_info=True)

db = firestore.client()

# --- Inicialización del Modelo de Embeddings (Google) ---
embeddings_model_instance: Optional[GoogleGenerativeAIEmbeddings] = None
try:
    # CORRECCIÓN: Usar GEMINI_API_KEY_BACKEND y EMBEDDING_MODEL_NAME (singular)
    gemini_api_key_valid_pdf = hasattr(settings, 'GEMINI_API_KEY_BACKEND') and settings.GEMINI_API_KEY_BACKEND
    embedding_model_name_valid_pdf = hasattr(settings, 'EMBEDDING_MODEL_NAME') and settings.EMBEDDING_MODEL_NAME

    if gemini_api_key_valid_pdf and embedding_model_name_valid_pdf:
        embeddings_model_instance = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL_NAME, # Singular
            google_api_key=settings.GEMINI_API_KEY_BACKEND, # Usar la clave correcta de tu .env y config.py
            task_type="retrieval_document"
        )
        logger.info(f"PDF_PROCESSOR: GoogleGenerativeAIEmbeddings model ({settings.EMBEDDING_MODEL_NAME}) initialized.")
    else:
        missing_keys_pdf = []
        if not gemini_api_key_valid_pdf:
            missing_keys_pdf.append("GEMINI_API_KEY_BACKEND")
        if not embedding_model_name_valid_pdf:
            missing_keys_pdf.append("EMBEDDING_MODEL_NAME (singular)")
        logger.error(f"PDF_PROCESSOR: Cannot initialize GoogleGenerativeAIEmbeddings. Missing or empty required settings: {', '.join(missing_keys_pdf)}. Please check your .env file and app/core/config.py.")
        embeddings_model_instance = None
except AttributeError as ae:
    logger.error(f"PDF_PROCESSOR: AttributeError initializing GoogleGenerativeAIEmbeddings: {ae}. This likely means GEMINI_API_KEY_BACKEND or EMBEDDING_MODEL_NAME is missing or misspelled in your Settings class (app/core/config.py) or .env file.", exc_info=True)
    embeddings_model_instance = None
except Exception as e:
    logger.error(f"PDF_PROCESSOR: Failed to initialize GoogleGenerativeAIEmbeddings: {e}", exc_info=True)
    embeddings_model_instance = None

# --- Pinecone SDK Client ---
pinecone_sdk_client: Optional[PineconeSdkClient] = None
if settings.PINECONE_API_KEY:
    try:
        pinecone_sdk_client = PineconeSdkClient(api_key=settings.PINECONE_API_KEY)
        logger.info(f"PDF_PROCESSOR: Pinecone SDK client initialized for management tasks.")
    except Exception as e:
        logger.error(f"PDF_PROCESSOR: Failed to initialize Pinecone SDK client: {e}", exc_info=True)
        pinecone_sdk_client = None
else:
    logger.warning("PDF_PROCESSOR: PINECONE_API_KEY not configured. Direct Pinecone SDK client will not be available.")


def extract_text_and_create_chunks(file_path: str, pdf_id: str, user_id: str) -> List[Document]:
    logger.info(f"Extracting text and creating chunks for PDF: {pdf_id} from path: {file_path}")
    full_text = ""
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            full_text += page.get_text("text")
        doc.close()

        if not full_text.strip():
            logger.warning(f"No text could be extracted from PDF: {pdf_id}")
            return []

        processed_data_dir = settings.PROCESSED_DATA_DIR
        if not os.path.exists(processed_data_dir):
            os.makedirs(processed_data_dir, exist_ok=True)
        txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
        try:
            with open(txt_file_path, "w", encoding="utf-8") as f:
                f.write(full_text)
            logger.info(f"Successfully saved full text for PDF {pdf_id} to {txt_file_path}")
        except Exception as e_save:
            logger.error(f"Failed to save full text for PDF {pdf_id} to {txt_file_path}: {e_save}")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            is_separator_regex=False,
        )
        texts = text_splitter.split_text(full_text)
        
        documents = [
            Document(
                page_content=text_chunk,
                metadata={
                    "pdf_id": pdf_id,
                    "user_id": user_id,
                    "chunk_index": i,
                    "source_filename": os.path.basename(file_path)
                }
            ) for i, text_chunk in enumerate(texts)
        ]
        logger.info(f"PDF {pdf_id} divided into {len(documents)} Langchain Document objects.")
        return documents

    except Exception as e:
        logger.error(f"Error during text extraction/chunking for {pdf_id}: {e}", exc_info=True)
        raise ValueError(f"Failed to extract text or create chunks for {pdf_id}: {str(e)}")


async def process_pdf_and_upsert_to_pinecone(
    pdf_id: str,
    user_id: str,
    pdf_content_bytes: bytes,
    original_file_name: str
):
    if not embeddings_model_instance:
        logger.error("Embeddings model (Google) is not initialized. Cannot process PDF for Pinecone.")
        raise RuntimeError("Embeddings model is not available. Check GEMINI_API_KEY_BACKEND and EMBEDDING_MODEL_NAME in settings.") # Mensaje actualizado
    if not settings.PINECONE_API_KEY or not settings.PINECONE_INDEX_NAME:
        logger.error("Pinecone API key or Index Name not configured. Cannot process PDF for Pinecone.")
        raise RuntimeError("Pinecone configuration is incomplete.")

    logger.info(f"Starting PDF processing for Pinecone: pdf_id={pdf_id}, user_id={user_id}, file_name='{original_file_name}'")
    
    tmp_pdf_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmpfile:
            tmpfile.write(pdf_content_bytes)
            tmp_pdf_path = tmpfile.name
        
        documents_to_upsert = extract_text_and_create_chunks(tmp_pdf_path, pdf_id, user_id)

        if not documents_to_upsert:
            message = f"No content/chunks extracted from PDF '{original_file_name}' (ID: {pdf_id}). Vector processing aborted."
            logger.warning(message)
            pdf_doc_ref_fail = db.collection("documentosPDF").document(pdf_id)
            pdf_doc_ref_fail.update({
                "status": "failed_no_vectorizable_content",
                "error_message": "No text could be extracted from the PDF for vector processing.",
                "chunk_count": 0,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
            return {
                "message": message, "pdf_id": pdf_id, "filename": original_file_name, 
                "status": "processed_text_only_no_vectors"
            }

        logger.info(f"Upserting {len(documents_to_upsert)} Langchain Documents to Pinecone for PDF ID: {pdf_id} in namespace: {pdf_id}")
        
        vector_store = PineconeVectorStore.from_documents(
            documents=documents_to_upsert,
            embedding=embeddings_model_instance,
            index_name=settings.PINECONE_INDEX_NAME,
            namespace=pdf_id
        )
        
        logger.info(f"Successfully upserted vectors to Pinecone for PDF ID: {pdf_id} using PineconeVectorStore.")

        pdf_doc_ref = db.collection("documentosPDF").document(pdf_id)
        file_metadata_update = {
            "status": "processed_pinecone",
            "chunk_count": len(documents_to_upsert),
            "vector_db_provider": "pinecone",
            "embedding_model_used": embeddings_model_instance.model if embeddings_model_instance and hasattr(embeddings_model_instance, 'model') else "unknown",
            "pinecone_namespace": pdf_id,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "error_message": firestore.DELETE_FIELD
        }
        pdf_doc_ref.update(file_metadata_update)
        
        message = f"PDF '{original_file_name}' (ID: {pdf_id}) processed and vectors stored in Pinecone."
        logger.info(message)
        return {"message": message, "pdf_id": pdf_id, "filename": original_file_name, "status": "processed_pinecone"}

    except ValueError as ve:
        logger.error(f"ValueError during PDF processing for {pdf_id}: {ve}", exc_info=True)
        pdf_doc_ref_err = db.collection("documentosPDF").document(pdf_id)
        pdf_doc_ref_err.update({"status": "failed_processing", "error_message": str(ve), "updatedAt": firestore.SERVER_TIMESTAMP})
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"General error during PDF processing for Pinecone, pdf_id {pdf_id}: {e}", exc_info=True)
        pdf_doc_ref_err = db.collection("documentosPDF").document(pdf_id)
        pdf_doc_ref_err.update({"status": "failed_processing", "error_message": str(e), "updatedAt": firestore.SERVER_TIMESTAMP})
        raise HTTPException(status_code=500, detail=f"Failed to process PDF and store in Pinecone: {str(e)}")
    finally:
        if tmp_pdf_path and os.path.exists(tmp_pdf_path):
            try:
                os.unlink(tmp_pdf_path)
                logger.debug(f"Temporary file {tmp_pdf_path} deleted.")
            except OSError as ose:
                logger.warning(f"Error deleting temporary file {tmp_pdf_path}: {ose}")

async def process_uploaded_pdf(file: Any, user_id: str, pdf_id: str) -> Dict[str, Any]:
    logger.info(f"Processing uploaded PDF: {file.filename}, for pdf_id: {pdf_id}, user_id: {user_id}")
    try:
        pdf_content_bytes = await file.read()
        if not pdf_content_bytes:
            raise ValueError("Uploaded PDF file is empty or could not be read.")
    except Exception as e:
        logger.error(f"Error reading uploaded file for pdf_id {pdf_id}: {e}")
        raise HTTPException(status_code=400, detail="Could not read uploaded file.")

    return await process_pdf_and_upsert_to_pinecone(
        pdf_id=pdf_id,
        user_id=user_id,
        pdf_content_bytes=pdf_content_bytes,
        original_file_name=file.filename if file.filename else "uploaded.pdf"
    )

async def process_pdf_from_storage_url(pdf_id: str, user_id: str, file_url: str) -> Dict[str, Any]:
    logger.info(f"Processing PDF from URL: {file_url}, for pdf_id: {pdf_id}, user_id: {user_id}")
    original_file_name = os.path.basename(file_url.split('?')[0]) if file_url else "file_from_url.pdf"

    if not file_url:
        logger.error(f"No file_url provided for pdf_id: {pdf_id}")
        raise HTTPException(status_code=400, detail="No file URL provided for processing.")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            pdf_content_bytes = response.content
        
        if not pdf_content_bytes:
            logger.error(f"Downloaded PDF from {file_url} is empty for pdf_id: {pdf_id}")
            raise ValueError(f"Downloaded PDF from {file_url} is empty.")
            
        return await process_pdf_and_upsert_to_pinecone(
            pdf_id=pdf_id,
            user_id=user_id,
            pdf_content_bytes=pdf_content_bytes,
            original_file_name=original_file_name
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error downloading PDF from URL {file_url} for pdf_id {pdf_id}: {e.response.status_code} - {e.response.text}", exc_info=True)
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to download PDF from URL: Server responded with {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(f"Request error downloading PDF from URL {file_url} for pdf_id {pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Network error while downloading PDF from URL.")
    except ValueError as ve:
        logger.error(f"ValueError after downloading PDF from URL {file_url} for pdf_id {pdf_id}: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error processing PDF from URL {file_url} for pdf_id {pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error processing PDF from URL: {str(e)}")

def list_user_pdfs_from_db(user_id: str) -> List[Dict[str, Any]]:
    logger.debug(f"Listing PDFs from 'documentosPDF' for teacher_id (idDocente): {user_id}")
    pdfs_list = []
    try:
        if not db:
            logger.error("Firestore client (db) not initialized. Cannot list user PDFs.")
            return pdfs_list

        pdfs_ref = db.collection("documentosPDF").where("idDocente", "==", user_id)
        
        try:
            pdfs_query = pdfs_ref.order_by("fechaSubida", direction=firestore.Query.DESCENDING)
            query_snapshot = pdfs_query.stream()
        except Exception as order_by_e:
            logger.warning(f"Could not apply ordering by 'fechaSubida' for user {user_id} (may need indexing or field may not exist on all docs): {order_by_e}. Fetching without ordering.")
            query_snapshot = pdfs_ref.stream()

        for doc_snapshot in query_snapshot:
            if doc_snapshot.exists:
                pdf_data = doc_snapshot.to_dict()
                if pdf_data:
                    pdf_data["id"] = doc_snapshot.id
                    pdfs_list.append(pdf_data)
            else:
                logger.debug(f"Document snapshot {doc_snapshot.id} did not exist during streaming (should not happen with stream).")
        
        logger.info(f"Found {len(pdfs_list)} PDFs for teacher {user_id}")
        return pdfs_list
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id} from Firestore: {e}", exc_info=True)
        return []

async def delete_pdf_from_firestore_and_storage(pdf_id: str, user_id: str) -> bool:
    if not db:
        logger.error("Firestore client (db) not initialized. Cannot delete PDF.")
        return False

    logger.info(f"Attempting to delete PDF and associated data from Firestore/Storage: pdf_id={pdf_id}, user_id={user_id}")
    pdf_doc_ref = db.collection("documentosPDF").document(pdf_id)
    
    try:
        pdf_snapshot = pdf_doc_ref.get()
        if not pdf_snapshot.exists:
            logger.warning(f"PDF document {pdf_id} not found in Firestore. Assuming already deleted.")
            return True

        pdf_data = pdf_snapshot.to_dict()
        if not pdf_data:
            logger.warning(f"PDF document {pdf_id} has no data in Firestore.")
            pdf_doc_ref.delete()
            return False

        if pdf_data.get("idDocente") != user_id:
            logger.error(f"User {user_id} is not authorized to delete PDF {pdf_id} owned by {pdf_data.get('idDocente')}.")
            raise PermissionError(f"User {user_id} not authorized to delete PDF {pdf_id}.")

        storage_path = pdf_data.get("nombreEnStorage")
        if storage_path:
            bucket = storage.bucket(settings.FIREBASE_STORAGE_BUCKET)
            blob = bucket.blob(storage_path)
            try:
                blob.delete()
                logger.info(f"Successfully deleted '{storage_path}' from Firebase Storage.")
            except Exception as storage_e:
                logger.warning(f"Could not delete '{storage_path}' from Firebase Storage: {storage_e}")
        else:
            logger.warning(f"No 'nombreEnStorage' found for PDF {pdf_id}. Cannot delete from Storage.")

        # Comentado: La eliminación del namespace de Pinecone se manejará desde main.py llamando a la función de rag_chain.py
        # if pinecone_sdk_client and settings.PINECONE_INDEX_NAME:
        #     try:
        #         pinecone_index_client = pinecone_sdk_client.Index(settings.PINECONE_INDEX_NAME)
        #         pinecone_index_client.delete(namespace=pdf_id)
        #         logger.info(f"Successfully submitted delete request for Pinecone namespace '{pdf_id}'.")
        #     except Exception as pinecone_e:
        #         logger.error(f"Error deleting Pinecone namespace '{pdf_id}': {pinecone_e}", exc_info=True)
        # else:
        #     logger.warning(f"Pinecone SDK client not available. Skipping Pinecone namespace deletion for {pdf_id}.")

        processed_data_dir = settings.PROCESSED_DATA_DIR
        txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
        if os.path.exists(txt_file_path):
            try:
                os.remove(txt_file_path)
                logger.info(f"Successfully deleted associated text file: {txt_file_path}")
            except Exception as e_txt:
                logger.warning(f"Could not delete associated text file {txt_file_path}: {e_txt}")

        pdf_doc_ref.delete()
        logger.info(f"Successfully deleted PDF metadata for {pdf_id} from Firestore.")
        
        return True

    except PermissionError as pe:
        logger.error(str(pe))
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        logger.error(f"Error deleting PDF {pdf_id} and its associated data: {e}", exc_info=True)
        return False
