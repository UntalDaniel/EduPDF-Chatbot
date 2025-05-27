# ia_backend/app/core/config.py
import os
from dotenv import load_dotenv
from typing import List, Union, Optional, Any, Dict # <--- CORRECCIÓN: Dict importado aquí

# Construir la ruta al archivo .env en la raíz de ia_backend
# __file__ es la ruta a config.py (ia_backend/app/core/config.py)
# os.path.dirname(__file__) -> ia_backend/app/core
# os.path.join(..., '..') -> ia_backend/app
# os.path.join(..., '..') -> ia_backend
# os.path.join(..., '.env') -> ia_backend/.env
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
    # Esta es la clave que se usará para los servicios de Google/Gemini en el backend.
    GEMINI_API_KEY_BACKEND: Optional[str] = os.getenv("GEMINI_API_KEY_BACKEND")
    
    # Modelo de embedding (singular)
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "models/embedding-001")

    # --- Pinecone Configuration ---
    PINECONE_API_KEY: Optional[str] = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: Optional[str] = os.getenv("PINECONE_INDEX_NAME")
    PINECONE_ENVIRONMENT: Optional[str] = os.getenv("PINECONE_ENVIRONMENT")

    # --- Firebase Configuration ---
    # Permitir que FIREBASE_SERVICE_ACCOUNT_KEY sea un dict (para JSON en string) o str (para path)
    FIREBASE_SERVICE_ACCOUNT_KEY_RAW: Optional[str] = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
    FIREBASE_SERVICE_ACCOUNT_KEY: Union[str, Dict[str, Any], None] = None # Se procesará en __init__
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
    
    PROCESSED_DATA_DIR: str = os.getenv("PROCESSED_DATA_DIR", "processed_data")
    
    DEFAULT_GEMINI_MODEL_RAG: str = os.getenv("DEFAULT_GEMINI_MODEL_RAG", "gemini-1.5-flash-latest")
    RAG_LLM_TEMPERATURE: float = float(os.getenv("RAG_LLM_TEMPERATURE", "0.3"))
    RAG_LLM_TIMEOUT_SECONDS: int = int(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "120"))
    RAG_VERBOSE: bool = os.getenv("RAG_VERBOSE", "False").lower() == "true"

    # --- Exam Generation Configuration ---
    EXAM_GEN_MAX_TEXT_FROM_FILE: int = int(os.getenv("EXAM_GEN_MAX_TEXT_FROM_FILE", "50000"))
    EXAM_GEN_NUM_CHUNKS_RETRIEVAL: int = int(os.getenv("EXAM_GEN_NUM_CHUNKS_RETRIEVAL", "15"))
    EXAM_GEN_MAX_TEXT_FROM_PINECONE: int = int(os.getenv("EXAM_GEN_MAX_TEXT_FROM_PINECONE", "30000"))
    EXAM_GEN_MIN_TEXT_LENGTH: int = int(os.getenv("EXAM_GEN_MIN_TEXT_LENGTH", "200"))
    DEFAULT_GEMINI_MODEL_EXAM_GEN: str = os.getenv("DEFAULT_GEMINI_MODEL_EXAM_GEN", "gemini-1.5-flash-latest")
    EXAM_GEN_LLM_TEMPERATURE: float = float(os.getenv("EXAM_GEN_LLM_TEMPERATURE", "0.4"))
    EXAM_GEN_LLM_TIMEOUT_SECONDS: float = float(os.getenv("EXAM_GEN_LLM_TIMEOUT_SECONDS", "180.0"))


    def __init__(self):
        # Procesar FIREBASE_SERVICE_ACCOUNT_KEY_RAW
        raw_key = self.FIREBASE_SERVICE_ACCOUNT_KEY_RAW
        if raw_key:
            if raw_key.strip().startswith("{"):
                try:
                    import json
                    self.FIREBASE_SERVICE_ACCOUNT_KEY = json.loads(raw_key)
                except json.JSONDecodeError:
                    print(f"ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY parece ser un JSON pero no se pudo parsear.")
                    self.FIREBASE_SERVICE_ACCOUNT_KEY = None
            else: # Asumir que es una ruta de archivo
                self.FIREBASE_SERVICE_ACCOUNT_KEY = raw_key
        else:
            # Si no está en .env, podría ser None o el default que tenías antes.
            # Por seguridad, es mejor que sea None si no se provee explícitamente.
            self.FIREBASE_SERVICE_ACCOUNT_KEY = None 
            print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY_RAW no está en .env. FIREBASE_SERVICE_ACCOUNT_KEY será None.")


        # Advertencias de configuración
        if not self.GEMINI_API_KEY_BACKEND:
            print("ADVERTENCIA DE CONFIGURACIÓN: GEMINI_API_KEY_BACKEND no está configurada en .env. Los servicios de Google AI no funcionarán.")
        
        if not self.PINECONE_API_KEY or not self.PINECONE_ENVIRONMENT or not self.PINECONE_INDEX_NAME:
            print("ADVERTENCIA DE CONFIGURACIÓN: PINECONE_API_KEY, PINECONE_ENVIRONMENT o PINECONE_INDEX_NAME no están configuradas. Pinecone no funcionará.")

        # Validar FIREBASE_SERVICE_ACCOUNT_KEY después de procesarlo
        if self.FIREBASE_SERVICE_ACCOUNT_KEY is None:
            print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY no se pudo determinar (ni desde .env como JSON string/path, ni como path por defecto). Firebase Admin SDK podría no inicializarse.")
        elif isinstance(self.FIREBASE_SERVICE_ACCOUNT_KEY, str): # Es una ruta de archivo
            if self.FIREBASE_SERVICE_ACCOUNT_KEY == "path/to/your/serviceAccountKey.json": # Chequear si es el valor por defecto no modificado
                 print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_SERVICE_ACCOUNT_KEY (como path) sigue con el valor por defecto. Debes configurarlo.")
            elif not os.path.isabs(self.FIREBASE_SERVICE_ACCOUNT_KEY):
                # Si es una ruta relativa, intentar resolverla desde la ubicación del .env
                # (o desde la raíz del proyecto ia_backend si .env está allí)
                # Asumimos que dotenv_path es la raíz de ia_backend si .env está allí
                possible_path = os.path.join(os.path.dirname(dotenv_path), self.FIREBASE_SERVICE_ACCOUNT_KEY)
                if not os.path.exists(possible_path):
                    print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta relativa: {self.FIREBASE_SERVICE_ACCOUNT_KEY} (interpretada como {possible_path})")
                else:
                    # Actualizar a la ruta absoluta si se encontró
                    self.FIREBASE_SERVICE_ACCOUNT_KEY = possible_path 
                    print(f"INFO: FIREBASE_SERVICE_ACCOUNT_KEY resuelta a ruta absoluta: {self.FIREBASE_SERVICE_ACCOUNT_KEY}")
            elif not os.path.exists(self.FIREBASE_SERVICE_ACCOUNT_KEY): # Es una ruta absoluta pero no existe
                 print(f"ADVERTENCIA DE CONFIGURACIÓN: El archivo de cuenta de servicio de Firebase no se encontró en la ruta absoluta especificada: {self.FIREBASE_SERVICE_ACCOUNT_KEY}")
        # Si es un dict, asumimos que es válido (ya parseado o cargado directamente)

        if not self.FIREBASE_STORAGE_BUCKET:
            print("ADVERTENCIA DE CONFIGURACIÓN: FIREBASE_STORAGE_BUCKET no está configurado.")

settings = Settings()
