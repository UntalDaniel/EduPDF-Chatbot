# ia_backend/app/models/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Literal, Dict, Any

# --- Schemas existentes para RAG y procesamiento de PDF (basado en tu repo) ---
class PDFProcessRequest(BaseModel):
    file_url: str = Field(..., description="URL to the PDF file in Firebase Storage")
    user_id: str = Field(..., description="User ID of the owner of the PDF")
    pdf_id: str = Field(..., description="Unique ID for the PDF document")

class PDFProcessResponse(BaseModel):
    message: str
    pdf_id: str
    # num_pages: int # Podrías añadir más metadatos si los devuelves
    # num_chunks: int

class QueryRequest(BaseModel):
    pdf_id: str = Field(..., description="ID of the processed PDF to query against")
    query: str = Field(..., description="User's query")
    user_id: Optional[str] = None # Opcional, dependiendo de tu lógica de autorización
    chat_history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Conversation history, e.g., [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]")

# --- DEFINICIONES RESTAURADAS/AÑADIDAS PARA RAG ---
class MessageInput(BaseModel):
    """Model for a single message in a chat history."""
    role: Literal["user", "assistant", "system", "human", "ai"] # Añadido human/ai para compatibilidad con Langchain
    content: str

class SourceDocument(BaseModel):
    """Model for a source document chunk used in RAG."""
    page_content: str = Field(description="The text content of the source chunk.")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata associated with the source chunk (e.g., page number, source PDF).")
    # score: Optional[float] = None # Si devuelves puntajes de similitud

class ChatResponse(BaseModel): # Este es el que causaba el error de importación
    """
    Response model for a RAG query, similar to QueryResponse but potentially
    more structured if used internally by rag_chain before final QueryResponse.
    Si QueryResponse ya cumple esta función, esta podría ser redundante o
    específica para una capa interna. Por ahora, la definimos como la necesita rag_chain.py.
    """
    answer: str = Field(description="The generated answer to the query.")
    sources: Optional[List[SourceDocument]] = Field(default=None, description="List of source documents that contributed to the answer.")
    history: Optional[List[MessageInput]] = Field(default=None, description="Updated chat history.")
    # query_id: Optional[str] = None # Podrías añadir un ID para la interacción

# --- QueryResponse (revisar si es lo mismo que ChatResponse o si se usan distintamente) ---
# Parece que QueryResponse es lo que tu endpoint /query-pdf/ devuelve al frontend.
# ChatResponse podría ser un modelo intermedio usado por rag_chain.py.
# Por ahora, mantendremos ambas si rag_chain.py las usa explícitamente.
class QueryResponse(BaseModel): # Ya estaba, solo para referencia contextual
    answer: str
    source_chunks: Optional[List[Dict[str, Any]]] = None # Chunks de donde se obtuvo la respuesta

class FeedbackRequest(BaseModel):
    query_id: Optional[str] = None # O un identificador de la interacción
    pdf_id: str
    query: str
    answer: str
    is_helpful: bool
    correction: Optional[str] = None
    user_id: Optional[str] = None

class FeedbackResponse(BaseModel):
    message: str
    feedback_id: str


# --- Nuevos Schemas para Generación de Exámenes ---

class QuestionConfig(BaseModel):
    """
    Configuration for the number of questions of each type.
    """
    vf_questions: int = Field(default=0, ge=0, description="Number of True/False questions")
    mc_questions: int = Field(default=0, ge=0, description="Number of Multiple Choice questions")
    # Futuro: open_questions: int = Field(default=0, ge=0, description="Number of Open-ended questions")
    # Futuro: fill_in_blanks_questions: int = Field(default=0, ge=0, description="Number of Fill-in-the-blanks questions")

class ExamGenerationRequest(BaseModel):
    """
    Request model for generating an exam.
    """
    pdf_id: str = Field(description="ID of the PDF document to base the exam on")
    sample_text_from_pdf: Optional[str] = Field(default=None, description="Sample text from the PDF for generation (temporary for development)")
    title: str = Field(default="Nuevo Examen", min_length=1, max_length=200, description="Title of the exam")
    question_config: QuestionConfig = Field(description="Configuration for the types and number of questions")
    difficulty: Literal["facil", "medio", "dificil"] = Field(default="medio", description="Difficulty level of the questions")

class TrueFalseQuestion(BaseModel):
    """
    Model for a True/False question.
    """
    id: str = Field(description="Unique ID for the question (e.g., UUID)")
    text: str = Field(description="The question text")
    type: Literal["V_F"] = "V_F"
    correct_answer: bool = Field(description="The correct boolean answer")
    explanation: Optional[str] = Field(default=None, description="Explanation for the answer")

class MultipleChoiceQuestion(BaseModel):
    """
    Model for a Multiple Choice question.
    """
    id: str = Field(description="Unique ID for the question (e.g., UUID)")
    text: str = Field(description="The question text")
    type: Literal["MC"] = "MC"
    options: List[str] = Field(min_items=2, max_items=6, description="List of choices, e.g., ['Option A', 'Option B', 'Option C', 'Option D']")
    correct_answer: str = Field(description="The text of the correct option (must be one of the provided options)")
    explanation: Optional[str] = Field(default=None, description="Explanation for the answer")

Question = Union[TrueFalseQuestion, MultipleChoiceQuestion]

class GeneratedExam(BaseModel):
    """
    Response model for a generated exam. This is what the API returns.
    """
    pdf_id: str
    title: str
    difficulty: Literal["facil", "medio", "dificil"]
    questions: List[Question] = Field(description="List of generated questions")

class LLMGeneratedTrueFalse(BaseModel):
    question_text: str = Field(description="El texto de la pregunta de verdadero o falso.")
    answer: bool = Field(description="La respuesta correcta (true o false).")
    explanation: Optional[str] = Field(default=None, description="Una breve explicación de por qué la respuesta es correcta o incorrecta.")

class LLMGeneratedMultipleChoice(BaseModel):
    question_text: str = Field(description="El texto de la pregunta de opción múltiple.")
    options: List[str] = Field(description="Una lista de opciones de respuesta (idealmente 3 distractores y 1 correcta).")
    correct_option_text: str = Field(description="El texto de la opción de respuesta correcta. Debe ser uno de los ítems en 'options'.")
    explanation: Optional[str] = Field(default=None, description="Una breve explicación de por qué la opción es correcta.")

class LLMGeneratedQuestions(BaseModel):
    """
    Modelo para el objeto JSON completo que se espera de la respuesta del LLM
    cuando se solicita la generación de preguntas con un esquema.
    """
    true_false_questions: Optional[List[LLMGeneratedTrueFalse]] = Field(default_factory=list)
    multiple_choice_questions: Optional[List[LLMGeneratedMultipleChoice]] = Field(default_factory=list)

