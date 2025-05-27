# ia_backend/app/core/config.py
import os
from dotenv import load_dotenv
from typing import List, Union, Optional

dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    print(f"INFO: Archivo .env cargado desde {dotenv_path}")
else:
    print(f"ADVERTENCIA: Archivo .env no encontrado en {dotenv_path}. Asegúrate de que exista si dependes de él para cargar configuraciones sensibles.")

class Settings:
    PROJECT_NAME: str = "EduPDF Chatbot IA Backend"
    PROJECT_VERSION: str = "1.0.0"

    # --- API Keys ---
    GEMINI_API_KEY_BACKEND: Optional[str] = os.getenv("GEMINI_API_KEY_BACKEND")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY") # Aunque no se use para Pinecone, es bueno tenerlo
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo") # Ejemplo, ajustar si se usa otro modelo

    # --- Pinecone Configuration ---
    PINECONE_API_KEY: Optional[str] = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: Optional[str] = os.getenv("PINECONE_INDEX_NAME")
    PINECONE_ENVIRONMENT: Optional[str] = os.getenv("PINECONE_ENVIRONMENT") # <--- AÑADIDO

    # --- Firebase Configuration ---
    FIREBASE_SERVICE_ACCOUNT_KEY: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "path/to/your/serviceAccountKey.json")
    FIREBASE_STORAGE_BUCKET: Optional[str] = os.getenv("FIREBASE_STORAGE_BUCKET")

    # --- Server Configuration ---
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "True").lower() == "true"

    # --- CORS ---
    BACKEND_CORS_ORIGINS_STR: str = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    BACKEND_CORS_ORIGINS: List[str] = [
        s.strip() for s in BACKEND_CORS_ORIGINS_STR.split(',') if s.strip()
    ]

    # --- Logging ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

    # --- PDF Processing & RAG Configuration ---
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    RAG_NUM_SOURCE_CHUNKS: int = int(os.getenv("RAG_NUM_SOURCE_CHUNKS", "4"))
    
    # --- Exam Generation Configuration (Defaults) ---
    # Directorio para guardar archivos de texto procesados (ej. _full_text.txt)
    PROCESSED_DATA_DIR: str = os.getenv("PROCESSED_DATA_DIR", "processed_data") 
    FAISS_INDEXES_DIR: str = os.getenv("FAISS_INDEXES_DIR", "faiss_indexes") # Usado como fallback si PROCESSED_DATA_DIR no está

    EXAM_GEN_MAX_TEXT_FROM_FILE: int = int(os.getenv("EXAM_GEN_MAX_TEXT_FROM_FILE", "50000"))
    EXAM_GEN_NUM_CHUNKS_RETRIEVAL: int = int(os.getenv("EXAM_GEN_NUM_CHUNKS_RETRIEVAL", "15"))
    EXAM_GEN_MAX_TEXT_FROM_PINECONE: int = int(os.getenv("EXAM_GEN_MAX_TEXT_FROM_PINECONE", "30000"))
    EXAM_GEN_MIN_TEXT_LENGTH: int = int(os.getenv("EXAM_GEN_MIN_TEXT_LENGTH", "200"))
    DEFAULT_GEMINI_MODEL_EXAM_GEN: str = os.getenv("DEFAULT_GEMINI_MODEL_EXAM_GEN", "gemini-1.5-flash-latest")
    EXAM_GEN_LLM_TEMPERATURE: float = float(os.getenv("EXAM_GEN_LLM_TEMPERATURE", "0.4"))
    EXAM_GEN_LLM_TIMEOUT_SECONDS: float = float(os.getenv("EXAM_GEN_LLM_TIMEOUT_SECONDS", "180.0"))

    # --- RAG Configuration (Defaults) ---
    DEFAULT_GEMINI_MODEL_RAG: str = os.getenv("DEFAULT_GEMINI_MODEL_RAG", "gemini-1.5-flash-latest")
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "models/embedding-001")
    RAG_LLM_TEMPERATURE: float = float(os.getenv("RAG_LLM_TEMPERATURE", "0.3"))
    RAG_LLM_TIMEOUT_SECONDS: int = int(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "120"))
    RAG_VERBOSE: bool = os.getenv("RAG_VERBOSE", "False").lower() == "true"


    def __init__(self):
        if not self.GEMINI_API_KEY_BACKEND: # Modificado para reflejar el nombre de la variable
            print("ADVERTENCIA DE CONFIGURACIÓN: GEMINI_API_KEY_BACKEND no está configurada.")
        
        # ... (resto de tus advertencias de configuración) ...
        if not self.PINECONE_API_KEY or not self.PINECONE_ENVIRONMENT or not self.PINECONE_INDEX_NAME: # <--- AÑADIDA VERIFICACIÓN DE PINECONE_ENVIRONMENT
            print("ADVERTENCIA DE CONFIGURACIÓN: PINECONE_API_KEY, PINECONE_ENVIRONMENT o PINECONE_INDEX_NAME no están configuradas.")

        if self.FIREBASE_SERVICE_ACCOUNT_KEY == "path/to/your/serviceAccountKey.json":
             print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY sigue con el valor por defecto. Debes configurarlo.")
        elif not self.FIREBASE_SERVICE_ACCOUNT_KEY.strip().startswith("{") and not os.path.isabs(self.FIREBASE_SERVICE_ACCOUNT_KEY):
             possible_path = os.path.join(os.path.dirname(dotenv_path), self.FIREBASE_SERVICE_ACCOUNT_KEY)
             if not os.path.exists(possible_path):
                 print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta: {self.FIREBASE_SERVICE_ACCOUNT_KEY} (intentado como {possible_path} si es relativa al .env)")
        elif not self.FIREBASE_SERVICE_ACCOUNT_KEY.strip().startswith("{") and not os.path.exists(self.FIREBASE_SERVICE_ACCOUNT_KEY):
             print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta absoluta especificada: {self.FIREBASE_SERVICE_ACCOUNT_KEY}")

        if not self.FIREBASE_STORAGE_BUCKET:
            print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_STORAGE_BUCKET no está configurado.")

settings = Settings()
