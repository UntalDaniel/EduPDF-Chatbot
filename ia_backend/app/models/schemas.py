# ia_backend/app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union, Literal, Dict, Any

# --- Schemas existentes para RAG y procesamiento de PDF ---
class PDFProcessRequest(BaseModel):
    file_url: str = Field(..., description="URL to the PDF file in Firebase Storage")
    user_id: str = Field(..., description="User ID of the owner of the PDF")
    pdf_id: str = Field(..., description="Unique ID for the PDF document")

class PDFProcessResponse(BaseModel):
    message: str
    pdf_id: str
    filename: Optional[str] = None 

class QueryRequest(BaseModel): 
    pdf_id: str = Field(..., description="ID of the processed PDF to query against")
    query: str = Field(..., description="User's query")
    user_id: Optional[str] = None 
    chat_history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Conversation history")

class MessageInput(BaseModel):
    role: Literal["user", "assistant", "system", "human", "ai"] 
    content: str

class SourceDocument(BaseModel):
    page_content: str = Field(description="The text content of the source chunk.")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata associated with the source chunk.")

class ChatResponse(BaseModel): 
    answer: str = Field(description="The generated answer to the query.")
    sources: Optional[List[SourceDocument]] = Field(default=None, description="List of source documents.")
    error: Optional[str] = None

# Definición de ChatRequestBody que estaba causando el ImportError
class ChatRequestBody(BaseModel): 
    user_question: str
    language: Optional[str] = 'es'
    model_id: Optional[str] = Field(default=None, description="ID del modelo de IA a usar para el chat RAG")
    chat_history: Optional[List[MessageInput]] = Field(default_factory=list)

class QueryResponse(BaseModel): 
    answer: str
    source_chunks: Optional[List[Dict[str, Any]]] = None 

class FeedbackRequest(BaseModel):
    query_id: Optional[str] = None 
    pdf_id: str
    query: str
    answer: str
    is_helpful: bool
    correction: Optional[str] = None
    user_id: Optional[str] = None

class FeedbackResponse(BaseModel):
    message: str
    feedback_id: str

# --- Schemas para Generación de Exámenes ---
class QuestionConfig(BaseModel):
    vf_questions: int = Field(default=0, ge=0, le=10, description="Number of True/False questions")
    mc_questions: int = Field(default=3, ge=0, le=10, description="Number of Multiple Choice questions")

class ExamGenerationRequest(BaseModel): 
    pdf_id: str = Field(description="ID of the PDF document to base the exam on")
    title: str = Field(default="Nuevo Examen", min_length=1, max_length=200, description="Title of the exam")
    question_config: QuestionConfig = Field(description="Configuration for the types and number of questions")
    difficulty: Literal["facil", "medio", "dificil"] = Field(default="medio", description="Difficulty level of the questions")
    language: str = Field(default="es", description="Language for the exam questions (e.g., 'es', 'en')")
    model_id: Optional[str] = Field(default="gemini-1.5-flash-latest", description="AI Model to use for exam generation")

class TrueFalseQuestion(BaseModel):
    id: str = Field(description="Unique ID for the question (e.g., UUID)")
    question_text: str = Field(..., min_length=1, description="The question text")
    type: Literal["V_F"] = "V_F" 
    correct_answer: bool = Field(description="The correct boolean answer")
    explanation: Optional[str] = Field(default=None, description="Explanation for the answer")

class MultipleChoiceQuestion(BaseModel):
    id: str = Field(description="Unique ID for the question (e.g., UUID)")
    question_text: str = Field(..., min_length=1, description="The question text") 
    type: Literal["MC"] = "MC" 
    options: List[str] = Field(..., min_items=2, max_items=6, description="List of choices")
    correct_answer_index: int = Field(..., ge=0, description="0-based index of the correct option in the 'options' list")
    explanation: Optional[str] = Field(default=None, description="Explanation for the answer")

    @field_validator('correct_answer_index')
    @classmethod
    def check_correct_answer_index(cls, v, info):
        # Pydantic v2 usa info.data para acceder a otros campos del modelo
        if 'options' in info.data and v >= len(info.data['options']):
            raise ValueError('correct_answer_index must be a valid index in the options list')
        return v

Question = Union[TrueFalseQuestion, MultipleChoiceQuestion] 

class GeneratedExam(BaseModel): 
    pdf_id: str
    title: str
    difficulty: Literal["facil", "medio", "dificil"]
    questions: List[Question] = Field(description="List of generated questions")
    error: Optional[str] = None 

class LLMGeneratedTrueFalse(BaseModel):
    question_text: str = Field(description="El texto de la pregunta de verdadero o falso.")
    answer: bool = Field(description="La respuesta correcta (true o false).")
    explanation: Optional[str] = Field(default=None, description="Una breve explicación.")

class LLMGeneratedMultipleChoice(BaseModel):
    question_text: str = Field(description="El texto de la pregunta de opción múltiple.")
    options: List[str] = Field(description="Una lista de opciones de respuesta (idealmente 3-4 opciones).")
    correct_option_text: str = Field(description="El texto de la opción de respuesta correcta. Debe ser uno de los ítems en 'options'.")
    explanation: Optional[str] = Field(default=None, description="Una breve explicación.")

class LLMGeneratedQuestions(BaseModel): 
    true_false_questions: Optional[List[LLMGeneratedTrueFalse]] = Field(default_factory=list)
    multiple_choice_questions: Optional[List[LLMGeneratedMultipleChoice]] = Field(default_factory=list)
