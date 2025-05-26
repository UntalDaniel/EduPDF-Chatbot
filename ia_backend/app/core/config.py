# ia_backend/app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv() # Carga variables desde un archivo .env si existe

# Configura tu API Key de Gemini como una variable de entorno para este backend
# En producción, configurarías esto en tu servidor/contenedor, no en un .env versionado
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_BACKEND")

if not GEMINI_API_KEY:
    print("ADVERTENCIA: GEMINI_API_KEY_BACKEND no está configurada en el entorno.")
    # Podrías lanzar un error aquí o tener un valor por defecto para desarrollo local extremo,
    # pero es mejor que siempre esté configurada.
    # raise ValueError("GEMINI_API_KEY_BACKEND debe estar configurada.")

# Podrías añadir aquí configuraciones para Firebase Admin SDK si este backend
# necesita interactuar directamente con Firebase (ej. para descargar PDFs).
# FIREBASE_SERVICE_ACCOUNT_KEY_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
