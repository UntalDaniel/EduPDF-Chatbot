# ia_backend/app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union, Literal, Dict, Any
import uuid 
from enum import Enum # <--- IMPORTACIÓN AÑADIDA

# --- Enums ---
class QuestionType(str, Enum): 
    TRUE_FALSE = "V_F" 
    MULTIPLE_CHOICE = "MC"
    OPEN = "OPEN"
    FILL_IN_THE_BLANK = "FITB" 

class DifficultyLevel(str, Enum): 
    FACIL = "facil"
    MEDIO = "medio"
    DIFICIL = "dificil"

class Language(str, Enum): 
    ES = "es"
    EN = "en"

class ModelChoice(str, Enum): 
    GEMINI_1_5_FLASH = "gemini-1.5-flash-latest"
    GEMINI_1_5_PRO = "gemini-1.5-pro-latest"


# --- Schemas existentes para RAG y procesamiento de PDF ---
class PDFProcessRequest(BaseModel):
    file_url: str = Field(..., description="URL to the PDF file in Firebase Storage")
    user_id: str = Field(..., description="User ID of the owner of the PDF")
    pdf_id: str = Field(..., description="Unique ID for the PDF document")

class PDFProcessResponse(BaseModel):
    message: str
    pdf_id: str
    filename: Optional[str] = None
    status: Optional[str] = None 

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

class ChatRequestBody(BaseModel): 
    user_question: str
    language: Optional[str] = 'es' # Debería ser Language enum si es consistente
    model_id: Optional[str] = Field(default=None, description="ID del modelo de IA a usar para el chat RAG") # Debería ser ModelChoice enum
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

class QuestionConfigForExam(BaseModel): 
    num_true_false: int = Field(default=0, ge=0, le=10, description="Number of True/False questions")
    num_multiple_choice: int = Field(default=0, ge=0, le=10, description="Number of Multiple Choice questions")
    num_open_questions: int = Field(default=0, ge=0, le=5, description="Number of Open-ended questions")
    num_fill_in_the_blank: int = Field(default=0, ge=0, le=5, description="Number of Fill-in-the-Blank questions") 
    
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIO)
    language: Language = Field(default=Language.ES) # Usar el Enum
    model_id: Optional[ModelChoice] = Field(default=ModelChoice.GEMINI_1_5_FLASH) # Usar el Enum
    user_id: str 

    class Config:
        populate_by_name = True 
        use_enum_values = True 

class BaseQuestionOutput(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str = Field(..., min_length=1)
    explanation: Optional[str] = Field(default=None)
    type: QuestionType 

class TrueFalseQuestionOutput(BaseQuestionOutput):
    type: Literal[QuestionType.TRUE_FALSE] = QuestionType.TRUE_FALSE
    correct_answer: bool

class MultipleChoiceQuestionOutput(BaseQuestionOutput):
    type: Literal[QuestionType.MULTIPLE_CHOICE] = QuestionType.MULTIPLE_CHOICE
    options: List[str] = Field(..., min_length=2, max_length=6)
    correct_answer_index: int = Field(..., ge=0)

    @field_validator('correct_answer_index')
    @classmethod
    def check_correct_answer_index(cls, v: int, info: Any): # info.data es el dict de datos del modelo
        options_data = info.data.get('options')
        if options_data and v >= len(options_data):
            raise ValueError('correct_answer_index must be a valid index in the options list')
        return v

class OpenQuestionOutput(BaseQuestionOutput):
    type: Literal[QuestionType.OPEN] = QuestionType.OPEN

class FillInTheBlankQuestionOutput(BaseQuestionOutput): 
    type: Literal[QuestionType.FILL_IN_THE_BLANK] = QuestionType.FILL_IN_THE_BLANK
    answers: List[str] = Field(..., min_length=1, description="Lista de respuestas correctas para los blanks, en orden.")

QuestionOutput = Union[TrueFalseQuestionOutput, MultipleChoiceQuestionOutput, OpenQuestionOutput, FillInTheBlankQuestionOutput] 

class ExamGenerationRequestFrontend(BaseModel): 
    pdf_id: str
    title: str = Field(default="Nuevo Examen", min_length=1, max_length=200)
    question_config: Dict[str, int] 
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIO)
    language: Language = Field(default=Language.ES) # Usar el Enum
    model_id: Optional[ModelChoice] = Field(default=ModelChoice.GEMINI_1_5_FLASH) # Usar el Enum
    user_id: str 

    class Config:
        use_enum_values = True

class GeneratedExamResponse(BaseModel): 
    pdf_id: str
    title: str
    difficulty: DifficultyLevel # Usar el Enum
    questions: List[QuestionOutput]
    config_used: Optional[QuestionConfigForExam] = None 
    error: Optional[str] = None 

    class Config:
        use_enum_values = True

class LLMGeneratedTrueFalse(BaseModel):
    question_text: str
    answer: bool
    explanation: Optional[str] = None

class LLMGeneratedMultipleChoice(BaseModel):
    question_text: str
    options: List[str] = Field(min_length=2, max_length=6)
    correct_option_text: str
    explanation: Optional[str] = None

    @field_validator('options')
    @classmethod
    def check_options_length(cls, v: List[str]):
        if not (2 <= len(v) <= 6) : 
             raise ValueError('Multiple choice questions must have between 2 and 6 options.')
        return v

    @field_validator('correct_option_text')
    @classmethod
    def check_correct_option_in_options(cls, v: str, info: Any): # info.data es el dict de datos del modelo
        options_data = info.data.get('options')
        if options_data and v.strip().lower() not in [opt.strip().lower() for opt in options_data]:
            raise ValueError(f"Correct option text '{v}' must be one of the provided options: {options_data}")
        return v

class LLMGeneratedOpenQuestion(BaseModel):
    question_text: str
    explanation_or_answer_guide: Optional[str] = None

class LLMGeneratedFillInTheBlank(BaseModel): 
    question_text_with_placeholders: str = Field(description="Texto de la pregunta con placeholders como __BLANK__ o [BLANK]")
    correct_answers: List[str] = Field(min_length=1, description="Lista de respuestas correctas en orden de los placeholders.")
    explanation: Optional[str] = None

class LLMGeneratedQuestions(BaseModel): 
    true_false_questions: Optional[List[LLMGeneratedTrueFalse]] = Field(default_factory=list)
    multiple_choice_questions: Optional[List[LLMGeneratedMultipleChoice]] = Field(default_factory=list)
    open_questions: Optional[List[LLMGeneratedOpenQuestion]] = Field(default_factory=list)
    fill_in_the_blank_questions: Optional[List[LLMGeneratedFillInTheBlank]] = Field(default_factory=list)

class RegenerateQuestionRequest(BaseModel):
    pdf_id: str 
    question_to_regenerate: Dict[str, Any] 
    exam_config: QuestionConfigForExam 
    existing_questions: Optional[List[Dict[str, Any]]] = None

    class Config:
        use_enum_values = True
        json_schema_extra = { 
            "example": {
                "pdf_id": "some_pdf_id_123",
                "question_to_regenerate": {
                    "id": "q_original_fitb_1",
                    "text": "El sol sale por el __BLANK__ y se pone por el __BLANK__.",
                    "type": "FITB", 
                    "answers": ["este", "oeste"],
                },
                "exam_config": {
                    "num_true_false": 0, 
                    "num_multiple_choice": 0,
                    "num_open_questions": 0,
                    "num_fill_in_the_blank": 0, 
                    "difficulty": "medio",
                    "language": "es",
                    "model_id": "gemini-1.5-flash-latest",
                    "user_id": "user_abc_789"
                },
                "existing_questions": []
            }
        }
