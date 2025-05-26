# ia_backend/app/models/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class MessageInput(BaseModel):
    role: str # 'user' o 'assistant' (o 'human'/'ai' según espere Langchain)
    content: str

class ChatRequestBody(BaseModel):
    user_question: str = Field(..., min_length=1, description="La pregunta del usuario.")
    language: Optional[str] = Field('es', description="El idioma deseado para la respuesta ('es' o 'en'). Por defecto es 'es'.")
    model_id: Optional[str] = Field("gemini-1.5-flash-latest", description="El ID del modelo Gemini a utilizar. Por defecto 'gemini-1.5-flash-latest'.")
    chat_history: Optional[List[MessageInput]] = Field([], description="Historial de la conversación para mantener contexto.")

class SourceDocument(BaseModel):
    page_content: str
    metadata: Dict[str, Any]

class ChatResponse(BaseModel):
    answer: str
    sources: Optional[List[SourceDocument]] = None
    # Opcionalmente, podrías devolver el historial actualizado si el backend lo gestiona
    # updated_chat_history: Optional[List[MessageInput]] = None

class ProcessPdfRequest(BaseModel):
    pdf_id: str
