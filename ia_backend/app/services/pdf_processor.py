# ia_backend/app/services/pdf_processor.py
import logging
import tempfile
import os
# CORRECCIÓN: Añadir Optional a la importación de typing
from typing import List, Dict, Any, Union, Optional

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
        # raise RuntimeError(f"Firebase Admin SDK initialization failed: {e}") from e

db = firestore.client()

# --- Inicialización de Embeddings (Google) ---
# Esta es la línea 45 donde ocurría el error. Ahora 'Optional' está definido.
embeddings_model: Optional[GoogleGenerativeAIEmbeddings] = None
if settings.GEMINI_API_KEY_BACKEND:
    try:
        embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001", 
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            task_type="retrieval_document" 
        )
        logger.info("GoogleGenerativeAIEmbeddings model (embedding-001) initialized in pdf_processor.")
    except Exception as e:
        logger.error(f"Failed to initialize GoogleGenerativeAIEmbeddings in pdf_processor: {e}", exc_info=True)
        embeddings_model = None 
else:
    logger.warning("GEMINI_API_KEY_BACKEND not set. GoogleEmbeddings model will not be available in pdf_processor.")

# --- Inicialización de Pinecone ---
pc: Optional[PineconeClient] = None
pinecone_index_instance: Optional[Any] = None 

if settings.PINECONE_API_KEY and settings.PINECONE_INDEX_NAME:
    try:
        logger.info(f"Initializing Pinecone client for index: {settings.PINECONE_INDEX_NAME}")
        # Asumiendo que PINECONE_ENVIRONMENT también está en tus settings si es necesario para PineconeClient v3+
        # Si PineconeClient solo necesita api_key, está bien. Si necesita 'environment', asegúrate que esté en settings.
        # Ejemplo para v3+ podría ser: pc = PineconeClient(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENVIRONMENT)
        pc = PineconeClient(api_key=settings.PINECONE_API_KEY) 
        
        active_indexes_data = pc.list_indexes() # Esto devuelve una lista de objetos IndexListEntry
        active_indexes = [idx_spec.name for idx_spec in active_indexes_data] # Ajustado para el objeto IndexListEntry

        if settings.PINECONE_INDEX_NAME not in active_indexes:
            logger.warning(f"Pinecone index '{settings.PINECONE_INDEX_NAME}' not found in active indexes: {active_indexes}. Please create it with 768 dimensions and cosine metric.")
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
            return []

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len
        )
        
        raw_chunks = text_splitter.split_text(text=text_content)
        
        # --- INICIO DE CORRECCIÓN PARA GUARDAR TEXTO COMPLETO ---
        # Guardar el texto completo si se extrajo correctamente
        if text_content.strip():
            processed_data_dir = getattr(settings, "PROCESSED_DATA_DIR", getattr(settings, "FAISS_INDEXES_DIR", "processed_data"))
            if not os.path.exists(processed_data_dir):
                os.makedirs(processed_data_dir)
            txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
            try:
                with open(txt_file_path, "w", encoding="utf-8") as f:
                    f.write(text_content)
                logger.info(f"Successfully saved full text for PDF {pdf_id} to {txt_file_path}")
            except Exception as e_save:
                logger.error(f"Failed to save full text for PDF {pdf_id} to {txt_file_path}: {e_save}")
        # --- FIN DE CORRECCIÓN PARA GUARDAR TEXTO COMPLETO ---

        processed_chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            chunk_metadata = {
                "pdf_id": pdf_id,
                "chunk_index": i,
                "source_document": os.path.basename(file_path), 
            }
            processed_chunks.append({
                "text": chunk_text,
                "metadata": chunk_metadata
            })
        
        logger.info(f"Created {len(processed_chunks)} chunks for PDF: {pdf_id}")
        return processed_chunks
        
    except Exception as e:
        logger.error(f"Error during text extraction/chunking for {pdf_id}: {e}", exc_info=True)
        raise ValueError(f"Failed to extract text or create chunks for {pdf_id}: {str(e)}")


async def process_pdf_and_upsert_to_pinecone(pdf_id: str, user_id: str, pdf_content_bytes: bytes, original_file_name: str):
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
        
        # extract_text_and_create_chunks ahora también guarda el texto completo.
        chunks_with_metadata = await extract_text_and_create_chunks(tmp_pdf_path, pdf_id)

        if not chunks_with_metadata:
            message = f"No content/chunks extracted from PDF '{original_file_name}' (ID: {pdf_id}). Processing aborted."
            logger.warning(message)
            # El guardado de _full_text.txt ya se intentó dentro de extract_text_and_create_chunks
            # y si falló, ya se logueó. Aquí solo manejamos el caso de no chunks para Pinecone.
            
            # Actualizar estado en Firestore a 'processed_text_only' si el texto completo se guardó pero no hay chunks (raro)
            # o 'failed_no_content' si tampoco se pudo guardar el texto completo.
            # Esta lógica puede simplificarse si extract_text_and_create_chunks lanza error si no hay texto.
            
            # Asumiendo que si chunks_with_metadata está vacío, text_content también lo estaba.
            pdf_doc_ref_fail = db.collection("documentosPDF").document(pdf_id) # Actualizar el documento principal
            await pdf_doc_ref_fail.update({ # Usar update en lugar de set para no borrar otros campos si ya existen
                "status": "failed_no_content", 
                "error_message": "No text could be extracted from the PDF for vector processing.",
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
            raise ValueError(message) 

        texts_to_embed = [chunk['text'] for chunk in chunks_with_metadata]
        metadatas_for_pinecone = [chunk['metadata'] for chunk in chunks_with_metadata]

        logger.info(f"Upserting {len(texts_to_embed)} vectors to Pinecone for PDF ID: {pdf_id} in namespace: {pdf_id}")
        
        vector_store = LangchainPinecone(
            index=pinecone_index_instance,
            embedding=embeddings_model,
            text_key="text", 
            namespace=pdf_id
        )
        
        await vector_store.aadd_texts(texts=texts_to_embed, metadatas=metadatas_for_pinecone)
        logger.info(f"Successfully upserted vectors to Pinecone for PDF ID: {pdf_id}")

        # Actualizar metadatos en Firestore (documento principal en 'documentosPDF')
        pdf_doc_ref = db.collection("documentosPDF").document(pdf_id)
        file_metadata_update = {
            "status": "processed_pinecone", 
            "chunk_count": len(chunks_with_metadata),
            "vector_db_provider": "pinecone",
            "embedding_model": embeddings_model.model if embeddings_model else "unknown",
            "pinecone_namespace": pdf_id,
            "updatedAt": firestore.SERVER_TIMESTAMP, # Añadir un campo de actualización
            "error_message": firestore.DELETE_FIELD # Borrar cualquier mensaje de error previo
        }
        await pdf_doc_ref.update(file_metadata_update)
        
        message = f"PDF '{original_file_name}' (ID: {pdf_id}) processed and vectors stored in Pinecone."
        logger.info(message)
        # La información devuelta al endpoint debería ser consistente con PDFProcessResponse
        return {"message": message, "pdf_id": pdf_id, "filename": original_file_name}


    except ValueError as ve: 
        logger.error(f"ValueError during PDF processing for {pdf_id}: {ve}", exc_info=True)
        raise 
    except Exception as e:
        logger.error(f"General error during PDF processing for Pinecone, pdf_id {pdf_id}: {e}", exc_info=True)
        pdf_doc_ref_err = db.collection("documentosPDF").document(pdf_id)
        try:
            await pdf_doc_ref_err.update({
                "status": "failed_processing", 
                "error_message": str(e), 
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
        except Exception as firestore_e:
            logger.error(f"Failed to update Firestore status to 'failed_processing' for {pdf_id}: {firestore_e}")
        raise RuntimeError(f"Failed to process PDF and store in Pinecone: {str(e)}")
    finally:
        if tmp_pdf_path and os.path.exists(tmp_pdf_path):
            try:
                os.unlink(tmp_pdf_path)
                logger.debug(f"Temporary file {tmp_pdf_path} deleted.")
            except OSError as ose:
                logger.warning(f"Error deleting temporary file {tmp_pdf_path}: {ose}")

# Funciones para interactuar con Firestore
async def get_pdf_metadata_from_firestore(pdf_id: str, user_id: str) -> Union[Dict[str, Any], None]:
    # Esta función parece diseñada para obtener metadatos de una subcolección de usuario.
    # Si los metadatos principales están en 'documentosPDF', podrías necesitar otra función o ajustar esta.
    logger.debug(f"Fetching PDF metadata for pdf_id: {pdf_id} under user_id: {user_id} (specific user subcollection path).")
    try:
        # Este path asume que los PDFs están anidados bajo usuarios
        pdf_doc_ref = db.collection("users").document(user_id).collection("pdfs").document(pdf_id)
        pdf_doc_snapshot = await pdf_doc_ref.get() 
        if pdf_doc_snapshot.exists:
            return pdf_doc_snapshot.to_dict()
        
        # Si no se encuentra allí, podría ser útil verificar la colección principal 'documentosPDF' también.
        logger.warning(f"PDF metadata for {pdf_id} not found under user {user_id}. Consider checking main 'documentosPDF' collection if applicable.")
        return None
    except Exception as e:
        logger.error(f"Error fetching PDF metadata for {pdf_id} from Firestore (user subcollection): {e}", exc_info=True)
        return None

async def list_user_pdfs_from_db(user_id: str) -> List[Dict[str, Any]]:
    # Esta función es para listar PDFs de la colección principal 'documentosPDF' filtrados por 'idDocente'
    logger.debug(f"Listing PDFs from 'documentosPDF' for teacher_id (idDocente): {user_id}")
    try:
        pdfs_ref = db.collection("documentosPDF").where("idDocente", "==", user_id).order_by("fechaSubida", direction=firestore.Query.DESCENDING)
        query_snapshot = await pdfs_ref.get()

        pdfs_list = []
        for doc_snapshot in query_snapshot: 
            pdf_data = doc_snapshot.to_dict()
            pdf_data["id"] = doc_snapshot.id # Añadir el ID del documento
            pdfs_list.append(pdf_data)
        logger.info(f"Found {len(pdfs_list)} PDFs for teacher {user_id}")
        return pdfs_list
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id} from Firestore: {e}", exc_info=True)
        return []

async def process_uploaded_pdf(file: Any, user_id: str, pdf_id: str) -> Dict[str, Any]:
    # 'pdf_id' aquí debería ser el ID del documento que ya se creó en Firestore
    # en el frontend o en el endpoint de subida antes de llamar a esta función.
    logger.info(f"Processing uploaded PDF: {file.filename}, for pdf_id: {pdf_id}, user_id: {user_id}")
    pdf_content_bytes = await file.read()
    if not pdf_content_bytes:
        raise ValueError("Uploaded PDF file is empty or could not be read.")
    
    # Esta función ahora asume que el registro en Firestore ya existe (creado por el frontend/TeacherDashboard).
    # Y que pdf_id es el ID de ese documento en la colección 'documentosPDF'.
    return await process_pdf_and_upsert_to_pinecone(
        pdf_id=pdf_id, 
        user_id=user_id, # user_id se usa para validación o logging, no para crear un nuevo doc aquí
        pdf_content_bytes=pdf_content_bytes, 
        original_file_name=file.filename if file.filename else "uploaded.pdf"
    )

async def process_pdf_from_storage_url(pdf_id: str, user_id: str, file_url: str) -> Dict[str, Any]:
    # Similar a process_uploaded_pdf, asume que el registro de Firestore para pdf_id ya existe.
    logger.info(f"Processing PDF from URL: {file_url}, for pdf_id: {pdf_id}, user_id: {user_id}")
    original_file_name = os.path.basename(file_url.split('?')[0]) 

    import httpx 
    try:
        async with httpx.AsyncClient(timeout=120.0) as client: 
            response = await client.get(file_url)
            response.raise_for_status()
            pdf_content_bytes = response.content
        
        if not pdf_content_bytes:
            raise ValueError(f"Downloaded PDF from {file_url} is empty.")
            
        return await process_pdf_and_upsert_to_pinecone(
            pdf_id=pdf_id, 
            user_id=user_id, 
            pdf_content_bytes=pdf_content_bytes, 
            original_file_name=original_file_name
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error downloading PDF from URL {file_url}: {e.response.status_code} - {e.response.text}", exc_info=True)
        raise RuntimeError(f"Failed to download PDF from URL: {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(f"Request error downloading PDF from URL {file_url}: {e}", exc_info=True)
        raise RuntimeError(f"Network error downloading PDF from URL.")
    except Exception as e:
        logger.error(f"Unexpected error processing PDF from URL {file_url}: {e}", exc_info=True)
        raise RuntimeError(f"Unexpected error processing PDF from URL: {str(e)}")

async def delete_pdf_from_firestore_and_storage(pdf_id: str, user_id: str) -> bool:
    """
    Deletes PDF metadata from Firestore and the corresponding file from Firebase Storage.
    Verifies ownership using user_id against idDocente.
    """
    if not db:
        logger.error("Firestore client (db) not initialized. Cannot delete PDF.")
        return False

    logger.info(f"Attempting to delete PDF from Firestore and Storage: pdf_id={pdf_id}, user_id={user_id}")
    
    pdf_doc_ref = db.collection("documentosPDF").document(pdf_id)
    
    try:
        pdf_snapshot = await pdf_doc_ref.get()
        if not pdf_snapshot.exists:
            logger.warning(f"PDF document {pdf_id} not found in Firestore. Cannot delete.")
            return False # O True si consideramos que no existe como "ya borrado"

        pdf_data = pdf_snapshot.to_dict()
        if not pdf_data: # Por si acaso to_dict() devuelve None
             logger.warning(f"PDF document {pdf_id} has no data in Firestore. Cannot verify ownership or get storage path.")
             return False

        # Verificación de propiedad
        if pdf_data.get("idDocente") != user_id:
            logger.error(f"User {user_id} is not authorized to delete PDF {pdf_id} owned by {pdf_data.get('idDocente')}.")
            # Podrías lanzar una HTTPException(status_code=403, detail="Forbidden") aquí
            # para que el endpoint lo maneje, o simplemente retornar False.
            # Por ahora, para que el endpoint sepa que falló por esta razón, podríamos propagar un error específico.
            raise PermissionError(f"User {user_id} not authorized to delete PDF {pdf_id}.")


        # Eliminar de Firebase Storage
        storage_path = pdf_data.get("nombreEnStorage")
        if storage_path:
            bucket = storage.bucket(settings.FIREBASE_STORAGE_BUCKET) # Obtener el bucket
            blob = bucket.blob(storage_path)
            try:
                await blob.delete() # La API de Python para Storage no es async directamente, pero envolvemos
                logger.info(f"Successfully deleted '{storage_path}' from Firebase Storage.")
            except Exception as storage_e: # google.cloud.exceptions.NotFound si no existe
                logger.warning(f"Could not delete '{storage_path}' from Firebase Storage (may not exist or error): {storage_e}")
                # No necesariamente un fallo total si el archivo ya no estaba, pero se loguea.
        else:
            logger.warning(f"No 'nombreEnStorage' found for PDF {pdf_id}. Cannot delete from Storage.")

        # Eliminar de Firestore
        await pdf_doc_ref.delete()
        logger.info(f"Successfully deleted PDF metadata for {pdf_id} from Firestore.")
        
        # (Opcional pero recomendado) Eliminar el archivo _full_text.txt si existe
        processed_data_dir = getattr(settings, "PROCESSED_DATA_DIR", getattr(settings, "FAISS_INDEXES_DIR", "processed_data"))
        txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
        if os.path.exists(txt_file_path):
            try:
                os.remove(txt_file_path)
                logger.info(f"Successfully deleted associated text file: {txt_file_path}")
            except Exception as e_txt:
                logger.warning(f"Could not delete associated text file {txt_file_path}: {e_txt}")
        
        return True

    except PermissionError as pe: # Capturar el error de permiso específico
        logger.error(str(pe))
        raise # Relanzar para que el endpoint lo maneje como un error de cliente (ej. 403)
    except Exception as e:
        logger.error(f"Error deleting PDF {pdf_id} from Firestore/Storage: {e}", exc_info=True)
        return False # Fallo general
