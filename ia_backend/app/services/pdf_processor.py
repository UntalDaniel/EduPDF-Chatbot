# ia_backend/app/services/pdf_processor.py
import fitz  # PyMuPDF
import tempfile
import os
import hashlib
import numpy as np # Necesario para FAISS
from typing import Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

from app.core.config import GEMINI_API_KEY

# --- Configuración de Embeddings ---
if not GEMINI_API_KEY:
    print("ADVERTENCIA DESDE PDF_PROCESSOR: GEMINI_API_KEY_BACKEND no parece estar configurada.")
    # Considera lanzar un error aquí también si es crítico para este módulo
    # raise ValueError("GEMINI_API_KEY_BACKEND es necesaria para pdf_processor.py")

try:
    embeddings_model = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=GEMINI_API_KEY
    )
except Exception as e:
    print(f"Error inicializando GoogleGenerativeAIEmbeddings en pdf_processor: {e}")
    raise RuntimeError(f"No se pudieron inicializar los embeddings: {e}") from e


# --- Directorio para guardar los índices FAISS ---
FAISS_INDEX_DIR = "faiss_indexes"
os.makedirs(FAISS_INDEX_DIR, exist_ok=True)


def get_faiss_index_path(pdf_id: str) -> str:
    """Genera un nombre de archivo único para el índice FAISS basado en el pdf_id."""
    # Limpiar pdf_id para que sea un nombre de archivo seguro
    safe_pdf_id = "".join(c if c.isalnum() else "_" for c in pdf_id)
    return os.path.join(FAISS_INDEX_DIR, f"{safe_pdf_id}_index")


async def process_pdf_and_create_index(pdf_id: str, pdf_content_bytes: bytes) -> FAISS:
    """
    Procesa el contenido de un PDF (bytes), extrae texto, crea chunks,
    genera embeddings y crea/guarda un índice FAISS.
    Devuelve el vectorstore FAISS.
    """
    print(f"Procesando PDF: {pdf_id}")
    tmp_pdf_path = None # Inicializar para el bloque finally
    try:
        # 1. Extraer texto del PDF (usando PyMuPDF)
        text_content = ""
        # Usar un archivo temporal nombrado para PyMuPDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
            tmp_pdf.write(pdf_content_bytes)
            tmp_pdf_path = tmp_pdf.name
        
        doc = fitz.open(tmp_pdf_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_content += page.get_text("text")
        doc.close()
        
        if not text_content.strip():
            print(f"No se pudo extraer texto del PDF: {pdf_id}")
            raise ValueError("No se pudo extraer texto del PDF.")

        # 2. Dividir el texto en chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150, # AJUSTADO a 150 (como en v1)
            length_function=len
        )
        chunks = text_splitter.split_text(text=text_content)

        if not chunks:
            print(f"No se pudieron crear chunks para el PDF: {pdf_id}")
            raise ValueError("No se pudieron crear chunks del texto.")
        
        print(f"PDF {pdf_id}: {len(chunks)} chunks creados con overlap de 150.")

        # 3. Generar embeddings y crear el índice FAISS
        print(f"Generando embeddings y creando índice FAISS para {pdf_id}...")
        if embeddings_model is None: # Verificación adicional
            raise RuntimeError("El modelo de embeddings no está inicializado.")
        
        vector_store = FAISS.from_texts(texts=chunks, embedding=embeddings_model)
        
        # 4. Guardar el índice FAISS localmente
        index_path = get_faiss_index_path(pdf_id)
        vector_store.save_local(index_path)
        print(f"Índice FAISS para {pdf_id} guardado en: {index_path}")
        
        return vector_store

    except Exception as e:
        print(f"Error procesando PDF {pdf_id}: {e}")
        raise # Re-lanzar la excepción para que sea manejada por el endpoint
    finally:
        # Asegurar que el archivo temporal se elimine incluso si hay errores
        if tmp_pdf_path and os.path.exists(tmp_pdf_path):
            try:
                os.remove(tmp_pdf_path)
                print(f"Archivo temporal {tmp_pdf_path} eliminado.")
            except OSError as ose:
                print(f"Error al intentar eliminar el archivo temporal {tmp_pdf_path}: {ose}")


async def load_faiss_index(pdf_id: str) -> Optional[FAISS]:
    """Carga un índice FAISS previamente guardado para un pdf_id."""
    index_path = get_faiss_index_path(pdf_id)
    if os.path.exists(index_path):
        try:
            print(f"Cargando índice FAISS existente para {pdf_id} desde {index_path}")
            if embeddings_model is None:
                 raise RuntimeError("El modelo de embeddings no está inicializado para cargar el índice.")
            vector_store = FAISS.load_local(
                index_path,
                embeddings_model,
                allow_dangerous_deserialization=True 
            )
            print(f"Índice FAISS para {pdf_id} cargado exitosamente.")
            return vector_store
        except Exception as e:
            print(f"Error al cargar el índice FAISS para {pdf_id} desde {index_path}: {e}")
            return None
    else:
        print(f"No se encontró índice FAISS para {pdf_id} en {index_path}")
        return None
