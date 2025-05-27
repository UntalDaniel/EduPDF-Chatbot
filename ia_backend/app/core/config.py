# ia_backend/app/core/config.py
import os
from dotenv import load_dotenv
from typing import List, Union, Optional

# Carga variables desde un archivo .env en el directorio raíz del backend (ia_backend/.env)
# Ruta corregida para buscar .env en ia_backend/
# __file__ es ia_backend/app/core/config.py
# os.path.dirname(__file__) es ia_backend/app/core/
# '..' sube a ia_backend/app/
# '..' sube a ia_backend/
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
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")
    PINECONE_API_KEY: Optional[str] = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: Optional[str] = os.getenv("PINECONE_INDEX_NAME")

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

    def __init__(self):
        # Las advertencias se imprimirán al crear la instancia settings
        # y también cuando el .env no se cargue correctamente.
        if not self.GEMINI_API_KEY_BACKEND and os.getenv("ENABLE_EXAM_GENERATION", "true").lower() == "true":
            print("ADVERTENCIA DE CONFIGURACIÓN: GEMINI_API_KEY_BACKEND no está configurada.")
        
        if not self.OPENAI_API_KEY:
            print("ADVERTENCIA DE CONFIGURACIÓN: OPENAI_API_KEY no está configurada.")
        
        if not self.PINECONE_API_KEY or not self.PINECONE_INDEX_NAME:
            print("ADVERTENCIA DE CONFIGURACIÓN: PINECONE_API_KEY o PINECONE_INDEX_NAME no están configuradas.")

        if self.FIREBASE_SERVICE_ACCOUNT_KEY == "path/to/your/serviceAccountKey.json":
             print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY sigue con el valor por defecto. Debes configurarlo.")
        elif not self.FIREBASE_SERVICE_ACCOUNT_KEY.strip().startswith("{") and not os.path.isabs(self.FIREBASE_SERVICE_ACCOUNT_KEY):
             # Si no es un JSON string y no es una ruta absoluta, intenta resolverla relativa al .env
             possible_path = os.path.join(os.path.dirname(dotenv_path), self.FIREBASE_SERVICE_ACCOUNT_KEY)
             if not os.path.exists(possible_path):
                 print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta: {self.FIREBASE_SERVICE_ACCOUNT_KEY} (intentado como {possible_path} si es relativa al .env)")
        elif not self.FIREBASE_SERVICE_ACCOUNT_KEY.strip().startswith("{") and not os.path.exists(self.FIREBASE_SERVICE_ACCOUNT_KEY):
             print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta absoluta especificada: {self.FIREBASE_SERVICE_ACCOUNT_KEY}")


        if not self.FIREBASE_STORAGE_BUCKET:
            print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_STORAGE_BUCKET no está configurado.")

settings = Settings()
