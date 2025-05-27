# ia_backend/app/services/pdf_processor.py
import logging
import tempfile
import os
from typing import List, Dict, Any, Union

import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Pinecone as LangchainPinecone # Langchain wrapper for Pinecone
from pinecone import Pinecone as PineconeClient # Direct Pinecone client for index management

import firebase_admin
from firebase_admin import storage, firestore, credentials

from app.core.config import settings # Importar la configuración centralizada

logger = logging.getLogger(__name__)

# --- Inicialización de Firebase Admin SDK ---
# (Asegúrate que esto se ejecute una sola vez. Si ya está en main.py o un startup event, es mejor)
if not firebase_admin._apps:
    try:
        if settings.FIREBASE_SERVICE_ACCOUNT_KEY.strip().startswith("{"):
            import json
            cred_obj = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
            cred = credentials.Certificate(cred_obj)
            logger.info("Initializing Firebase Admin SDK with JSON object from settings.")
        else:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
            logger.info(f"Initializing Firebase Admin SDK with service account file: {settings.FIREBASE_SERVICE_ACCOUNT_KEY}")
        
        firebase_admin.initialize_app(cred, {
            'storageBucket': settings.FIREBASE_STORAGE_BUCKET
        })
        logger.info(f"Firebase Admin SDK initialized in pdf_processor. Storage bucket: {settings.FIREBASE_STORAGE_BUCKET}")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK in pdf_processor: {e}", exc_info=True)
        # Considerar la estrategia de error: ¿debería la app detenerse si Firebase no se inicializa?
        # raise RuntimeError(f"Firebase Admin SDK initialization failed: {e}") from e

db = firestore.client()

# --- Inicialización de Embeddings (Google) ---
embeddings_model: Optional[GoogleGenerativeAIEmbeddings] = None
if settings.GEMINI_API_KEY_BACKEND:
    try:
        embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001", # 768 dimensiones
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            task_type="retrieval_document" # Especificar task_type para embeddings de documentos
        )
        logger.info("GoogleGenerativeAIEmbeddings model (embedding-001) initialized in pdf_processor.")
    except Exception as e:
        logger.error(f"Failed to initialize GoogleGenerativeAIEmbeddings in pdf_processor: {e}", exc_info=True)
        embeddings_model = None # Asegurar que es None si falla
else:
    logger.warning("GEMINI_API_KEY_BACKEND not set. GoogleEmbeddings model will not be available in pdf_processor.")

# --- Inicialización de Pinecone ---
pc: Optional[PineconeClient] = None
pinecone_index_instance: Optional[Any] = None # Para la instancia del índice de Pinecone

if settings.PINECONE_API_KEY and settings.PINECONE_INDEX_NAME:
    try:
        logger.info(f"Initializing Pinecone client for index: {settings.PINECONE_INDEX_NAME}")
        pc = PineconeClient(api_key=settings.PINECONE_API_KEY)
        
        active_indexes = [idx_spec.name for idx_spec in pc.list_indexes()]
        if settings.PINECONE_INDEX_NAME not in active_indexes:
            logger.warning(f"Pinecone index '{settings.PINECONE_INDEX_NAME}' not found in active indexes: {active_indexes}. Please create it with 768 dimensions and cosine metric.")
            # NO creamos el índice aquí automáticamente, debe estar pre-creado.
            pinecone_index_instance = None
        else:
            pinecone_index_instance = pc.Index(settings.PINECONE_INDEX_NAME)
            logger.info(f"Successfully connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
            logger.debug(f"Pinecone index stats: {pinecone_index_instance.describe_index_stats()}")
    except Exception as e:
        logger.error(f"Failed to initialize Pinecone in pdf_processor: {e}", exc_info=True)
        pc = None
        pinecone_index_instance = None
else:
    logger.warning("PINECONE_API_KEY or PINECONE_INDEX_NAME not configured. Pinecone integration will be disabled in pdf_processor.")


async def extract_text_and_create_chunks(file_path: str, pdf_id: str) -> List[Dict[str, Any]]:
    """
    Extracts text from a PDF and splits it into manageable chunks with metadata.
    """
    logger.info(f"Extracting text and creating chunks for PDF: {pdf_id} from path: {file_path}")
    text_content = ""
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_content += page.get_text("text")
        doc.close()
        
        if not text_content.strip():
            logger.warning(f"No text could be extracted from PDF: {pdf_id}")
            return [] # Devolver lista vacía si no hay texto

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len
        )
        # Langchain espera una lista de Documentos, pero para from_texts podemos pasar strings.
        # Sin embargo, para mantener metadatos por chunk, es mejor construir los objetos Document o pasar metadatos separados.
        # Aquí, construiremos una lista de diccionarios para pasar a LangchainPinecone.from_texts o aadd_texts.
        
        raw_chunks = text_splitter.split_text(text=text_content)
        
        processed_chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            # Tratar de obtener el número de página. PyMuPDF no lo da directamente por chunk.
            # Esto es una simplificación; una mejor manera sería procesar página por página.
            # Por ahora, asignaremos un source general.
            chunk_metadata = {
                "pdf_id": pdf_id,
                "chunk_index": i,
                "source_document": os.path.basename(file_path), # O el nombre original del PDF
                # "page_number": page_num_of_chunk # Esto requeriría un chunking más sofisticado
            }
            processed_chunks.append({
                "text": chunk_text,
                "metadata": chunk_metadata
            })
        
        logger.info(f"Created {len(processed_chunks)} chunks for PDF: {pdf_id}")
        return processed_chunks
        
    except Exception as e:
        logger.error(f"Error during text extraction/chunking for {pdf_id}: {e}", exc_info=True)
        # No relanzar HTTPException aquí, dejar que la función llamante lo maneje.
        raise ValueError(f"Failed to extract text or create chunks for {pdf_id}: {str(e)}")


async def process_pdf_and_upsert_to_pinecone(pdf_id: str, user_id: str, pdf_content_bytes: bytes, original_file_name: str):
    """
    Processes PDF content, extracts chunks, generates embeddings, and upserts to Pinecone.
    Also saves metadata to Firestore.
    """
    if not embeddings_model:
        logger.error("Embeddings model (Google) is not initialized. Cannot process PDF for Pinecone.")
        raise RuntimeError("Embeddings model is not available.")
    if not pinecone_index_instance:
        logger.error("Pinecone index is not initialized. Cannot process PDF for Pinecone.")
        raise RuntimeError("Pinecone connection is not established or index not found.")

    logger.info(f"Starting PDF processing for Pinecone: pdf_id={pdf_id}, user_id={user_id}, file_name='{original_file_name}'")
    
    tmp_pdf_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmpfile:
            tmpfile.write(pdf_content_bytes)
            tmp_pdf_path = tmpfile.name
        
        chunks_with_metadata = await extract_text_and_create_chunks(tmp_pdf_path, pdf_id)

        if not chunks_with_metadata:
            message = f"No content/chunks extracted from PDF '{original_file_name}' (ID: {pdf_id}). Processing aborted."
            logger.warning(message)
            # Guardar estado de error en Firestore
            pdf_doc_ref_fail = db.collection("users").document(user_id).collection("pdfs").document(pdf_id)
            await pdf_doc_ref_fail.set({
                "pdf_id": pdf_id, "user_id": user_id, "file_name": original_file_name,
                "status": "failed_no_content", "uploaded_at": firestore.SERVER_TIMESTAMP,
                "error_message": "No text could be extracted from the PDF."
            }, merge=True)
            raise ValueError(message) # Para que el endpoint devuelva un error apropiado

        texts_to_embed = [chunk['text'] for chunk in chunks_with_metadata]
        metadatas_for_pinecone = [chunk['metadata'] for chunk in chunks_with_metadata]

        logger.info(f"Upserting {len(texts_to_embed)} vectors to Pinecone for PDF ID: {pdf_id} in namespace: {pdf_id}")
        
        # Usar LangchainPinecone para añadir textos con metadatos
        # El pdf_id se usa como namespace en Pinecone para aislar los vectores de cada PDF
        vector_store = LangchainPinecone(
            index=pinecone_index_instance,
            embedding=embeddings_model,
            text_key="text", # LangchainPinecone por defecto usa 'text' para el contenido
            namespace=pdf_id
        )
        
        # aadd_texts es asíncrono
        await vector_store.aadd_texts(texts=texts_to_embed, metadatas=metadatas_for_pinecone)
        logger.info(f"Successfully upserted vectors to Pinecone for PDF ID: {pdf_id}")

        # Guardar metadatos en Firestore
        pdf_doc_ref = db.collection("users").document(user_id).collection("pdfs").document(pdf_id)
        file_metadata = {
            "pdf_id": pdf_id,
            "user_id": user_id,
            "file_name": original_file_name,
            "status": "processed_pinecone", # Nuevo estado
            "uploaded_at": firestore.SERVER_TIMESTAMP,
            "chunk_count": len(chunks_with_metadata),
            "vector_db_provider": "pinecone",
            "embedding_model": "models/embedding-001",
            "pinecone_namespace": pdf_id
        }
        await pdf_doc_ref.set(file_metadata, merge=True)
        
        message = f"PDF '{original_file_name}' (ID: {pdf_id}) processed and vectors stored in Pinecone."
        logger.info(message)
        return {"message": message, "pdf_id": pdf_id, "metadata": file_metadata}

    except ValueError as ve: # Capturar ValueError de extract_text_and_create_chunks
        logger.error(f"ValueError during PDF processing for {pdf_id}: {ve}", exc_info=True)
        raise # Re-lanzar para que el endpoint lo maneje
    except Exception as e:
        logger.error(f"General error during PDF processing for Pinecone, pdf_id {pdf_id}: {e}", exc_info=True)
        # Actualizar estado en Firestore a 'failed'
        pdf_doc_ref_err = db.collection("users").document(user_id).collection("pdfs").document(pdf_id)
        await pdf_doc_ref_err.set({
            "status": "failed_processing", "error_message": str(e), "updated_at": firestore.SERVER_TIMESTAMP
        }, merge=True)
        raise RuntimeError(f"Failed to process PDF and store in Pinecone: {str(e)}")
    finally:
        if tmp_pdf_path and os.path.exists(tmp_pdf_path):
            try:
                os.unlink(tmp_pdf_path)
                logger.debug(f"Temporary file {tmp_pdf_path} deleted.")
            except OSError as ose:
                logger.warning(f"Error deleting temporary file {tmp_pdf_path}: {ose}")

# Funciones para interactuar con Firestore (ya las tenías, las mantengo para completitud)
async def get_pdf_metadata_from_db(pdf_id: str, user_id: str) -> Union[Dict[str, Any], None]:
    logger.debug(f"Fetching metadata for pdf_id: {pdf_id}, user_id: {user_id}")
    try:
        pdf_doc_ref = db.collection("users").document(user_id).collection("pdfs").document(pdf_id)
        pdf_doc_snapshot = await pdf_doc_ref.get() # Firestore V9+ usa get() y es async
        if pdf_doc_snapshot.exists:
            return pdf_doc_snapshot.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error fetching PDF metadata for {pdf_id} from Firestore: {e}", exc_info=True)
        return None # O relanzar si es crítico

async def list_user_pdfs_from_db(user_id: str) -> List[Dict[str, Any]]:
    logger.debug(f"Listing PDFs for user_id: {user_id} from Firestore")
    try:
        pdfs_ref = db.collection("users").document(user_id).collection("pdfs")
        # query_results = await pdfs_ref.order_by("uploaded_at", direction=firestore.Query.DESCENDING).get() # Para V9+
        query_snapshot = await pdfs_ref.order_by("uploaded_at", direction=firestore.Query.DESCENDING).get()


        pdfs_list = []
        for doc_snapshot in query_snapshot: # Iterar sobre DocumentSnapshot
            pdfs_list.append(doc_snapshot.to_dict())
        return pdfs_list
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id} from Firestore: {e}", exc_info=True)
        return [] # Devolver lista vacía en caso de error

# La función que tu main.py llama (process_uploaded_pdf) ahora llamará a la lógica de Pinecone
async def process_uploaded_pdf(file: Any, user_id: str, pdf_id: str) -> Dict[str, Any]:
    """
    Processes an uploaded PDF file, stores in Pinecone, and saves metadata.
    'file' es UploadFile de FastAPI.
    """
    logger.info(f"Processing uploaded PDF: {file.filename}, pdf_id: {pdf_id}, user_id: {user_id}")
    pdf_content_bytes = await file.read()
    if not pdf_content_bytes:
        raise ValueError("Uploaded PDF file is empty or could not be read.")
    return await process_pdf_and_upsert_to_pinecone(pdf_id, user_id, pdf_content_bytes, file.filename if file.filename else "uploaded.pdf")

# La función que tu main.py llama (process_pdf_from_storage_url) ahora llamará a la lógica de Pinecone
async def process_pdf_from_storage_url(pdf_id: str, user_id: str, file_url: str) -> Dict[str, Any]:
    """
    Downloads a PDF from a URL, processes it, stores in Pinecone, and saves metadata.
    """
    logger.info(f"Processing PDF from URL: {file_url}, pdf_id: {pdf_id}, user_id: {user_id}")
    original_file_name = os.path.basename(file_url.split('?')[0]) # Intenta obtener un nombre de archivo

    import httpx # Mover importación aquí para que solo se use si se llama a esta función
    try:
        async with httpx.AsyncClient(timeout=120.0) as client: # Aumentar timeout para descargas grandes
            response = await client.get(file_url)
            response.raise_for_status()
            pdf_content_bytes = response.content
        
        if not pdf_content_bytes:
            raise ValueError(f"Downloaded PDF from {file_url} is empty.")
            
        return await process_pdf_and_upsert_to_pinecone(pdf_id, user_id, pdf_content_bytes, original_file_name)

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error downloading PDF from URL {file_url}: {e.response.status_code} - {e.response.text}", exc_info=True)
        raise RuntimeError(f"Failed to download PDF from URL: {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(f"Request error downloading PDF from URL {file_url}: {e}", exc_info=True)
        raise RuntimeError(f"Network error downloading PDF from URL.")
    except Exception as e:
        logger.error(f"Unexpected error processing PDF from URL {file_url}: {e}", exc_info=True)
        raise RuntimeError(f"Unexpected error processing PDF from URL: {str(e)}")

