# ia_backend/app/services/exam_generator_service.py
import logging
import uuid
import json
import httpx 
import os
from typing import List, Dict, Optional, Union, Literal, Any
import re

from pydantic import ValidationError, BaseModel

# Importaciones actualizadas desde tus schemas
from app.models.schemas import (
    ExamGenerationRequestFrontend as ExamGenerationRequest, 
    GeneratedExamResponse as GeneratedExam, 
    LLMGeneratedQuestions,    
    LLMGeneratedTrueFalse,
    LLMGeneratedMultipleChoice,
    LLMGeneratedOpenQuestion,
    LLMGeneratedFillInTheBlank, # <--- AÑADIDO
    RegenerateQuestionRequest,
    QuestionConfigForExam,
    QuestionOutput,
    TrueFalseQuestionOutput,
    MultipleChoiceQuestionOutput,
    OpenQuestionOutput,
    FillInTheBlankQuestionOutput, # <--- AÑADIDO
    BaseQuestionOutput,
    QuestionType # Importar el Enum QuestionType
)
from app.core.config import settings
from app.services.rag_chain import get_vector_store_for_pdf_retrieval 

logger = logging.getLogger(__name__)

class PdfIdRequest(BaseModel):
    pdfId: str

# --- Función existente para obtener contenido del PDF ---
async def get_pdf_content_for_exam_generation(pdf_id: str, user_id: str, sample_text_from_pdf: Optional[str] = None) -> str:
    if sample_text_from_pdf:
        logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Using provided sample_text_from_pdf.")
        return sample_text_from_pdf

    processed_data_dir = settings.PROCESSED_DATA_DIR
    txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
    
    if os.path.exists(txt_file_path):
        logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Found full text file at {txt_file_path}.")
        try:
            with open(txt_file_path, "r", encoding="utf-8") as f:
                full_text = f.read()
            if full_text.strip():
                logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Loaded full text from file, length: {len(full_text)}.")
                max_text_for_llm_from_file = settings.EXAM_GEN_MAX_TEXT_FROM_FILE
                if len(full_text) > max_text_for_llm_from_file:
                    logger.warning(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Full text from file is too long ({len(full_text)} chars), truncating to {max_text_for_llm_from_file} chars.")
                    return full_text[:max_text_for_llm_from_file]
                return full_text
            else:
                logger.warning(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Full text file {txt_file_path} is empty.")
        except Exception as e:
            logger.error(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Error reading full text file {txt_file_path}: {e}", exc_info=True)

    logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Full text file not found or empty. Attempting to retrieve from Pinecone.")
    vector_store = get_vector_store_for_pdf_retrieval(pdf_id) 
    if not vector_store:
        logger.warning(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Vector store not found. Cannot retrieve text for exam generation.")
        return (
            "No se pudo acceder al contenido del PDF para generar el examen. "
            "Por favor, asegúrese de que el documento haya sido procesado correctamente. "
        )
    try:
        num_chunks_to_retrieve = settings.EXAM_GEN_NUM_CHUNKS_RETRIEVAL
        logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Performing similarity search for up to {num_chunks_to_retrieve} chunks.")
        retriever = vector_store.as_retriever(search_kwargs={"k": num_chunks_to_retrieve})
        sample_docs = await retriever.aget_relevant_documents("Conceptos clave y resumen general del documento.") 
        
        if sample_docs:
            retrieved_texts = [doc.page_content for doc in sample_docs]
            concatenated_text = "\n\n---\n\n".join(retrieved_texts)
            logger.info(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Retrieved {len(sample_docs)} chunks from Pinecone. Total length: {len(concatenated_text)}")
            max_text_for_llm_from_pinecone = settings.EXAM_GEN_MAX_TEXT_FROM_PINECONE
            if len(concatenated_text) > max_text_for_llm_from_pinecone:
                logger.warning(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Concatenated text from Pinecone is too long ({len(concatenated_text)} chars), truncating to {max_text_for_llm_from_pinecone} chars.")
                return concatenated_text[:max_text_for_llm_from_pinecone]
            return concatenated_text
        else:
            logger.warning(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): No sample chunks retrieved from Pinecone.")
            return "No se pudieron recuperar fragmentos específicos del PDF desde la base de datos vectorial."
    except Exception as e:
        logger.error(f"ExamGen (pdf_id: {pdf_id}, user: {user_id}): Error retrieving content from Pinecone: {e}", exc_info=True)
        return "Ocurrió un error al acceder al contenido del PDF para la generación del examen."

# --- Función para llamar a Gemini API (para generación de examen completo) ---
async def generate_questions_via_gemini_api(
    text_content: str,
    num_vf: int,
    num_mc: int,
    num_open: int,
    num_fitb: int, # <--- NUEVO PARÁMETRO
    difficulty: Literal["facil", "medio", "dificil"],
    language: str,
    model_id_exam_gen: str
) -> Optional[LLMGeneratedQuestions]:
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("ExamGen LLM (Full Exam): GEMINI_API_KEY_BACKEND is not set in settings.")
        raise ValueError("La clave API de Gemini para el backend no está configurada.")

    simplified_response_schema: Dict[str, Any] = {"type": "OBJECT", "properties": {}}
    
    # Schema para Verdadero/Falso
    if num_vf > 0:
        simplified_response_schema["properties"]["true_false_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_vf} preguntas Verdadero/Falso.",
            "items": {
                "type": "OBJECT",
                "properties": { "question_text": {"type": "STRING"}, "answer": {"type": "BOOLEAN"}, "explanation": {"type": "STRING"} },
                "required": ["question_text", "answer"]
            }
        }
    # Schema para Opción Múltiple
    if num_mc > 0:
        simplified_response_schema["properties"]["multiple_choice_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_mc} preguntas Opción Múltiple.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question_text": {"type": "STRING"}, 
                    "options": {"type": "ARRAY", "items": {"type": "STRING"}}, 
                    "correct_option_text": {"type": "STRING"}, 
                    "explanation": {"type": "STRING"}
                }, "required": ["question_text", "options", "correct_option_text"]
            }
        }
    # Schema para Preguntas Abiertas
    if num_open > 0: 
        simplified_response_schema["properties"]["open_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_open} preguntas abiertas.",
            "items": {
                "type": "OBJECT",
                "properties": { "question_text": {"type": "STRING"}, "explanation_or_answer_guide": {"type": "STRING"} },
                "required": ["question_text"]
            }
        }
    # Schema para Preguntas para Completar (Fill-in-the-Blank) <--- NUEVO
    if num_fitb > 0:
        simplified_response_schema["properties"]["fill_in_the_blank_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_fitb} preguntas para completar espacios.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question_text_with_placeholders": {"type": "STRING", "description": "Texto con placeholders como __BLANK__."},
                    "correct_answers": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Lista de respuestas en orden."},
                    "explanation": {"type": "STRING", "description": "Explicación (opcional)."}
                },
                "required": ["question_text_with_placeholders", "correct_answers"]
            }
        }

    if not simplified_response_schema["properties"]: 
        logger.info("ExamGen LLM (Full Exam): No questions requested. Skipping LLM call.")
        return LLMGeneratedQuestions(
            true_false_questions=[], 
            multiple_choice_questions=[], 
            open_questions=[],
            fill_in_the_blank_questions=[] # <--- AÑADIDO
        )

    prompt_parts = [
        f"Eres un asistente experto en crear preguntas de examen en idioma '{language}' con un nivel de dificultad '{difficulty}'. Basándote ESTRICTAMENTE en el siguiente texto, genera preguntas de examen.",
        "Instrucciones Importantes para la Generación de Preguntas:",
        "1. Diversidad de Contenido: Asegúrate de que cada pregunta evalúe un aspecto o concepto DIFERENTE del texto. Evita redundancias.",
        "2. Cantidad Exacta: Debes generar exactamente:"
    ]
    if num_vf > 0: prompt_parts.append(f"   - {num_vf} preguntas de Verdadero/Falso.")
    if num_mc > 0: prompt_parts.append(f"   - {num_mc} preguntas de Opción Múltiple (cada una con 3 a 4 opciones).")
    if num_open > 0: prompt_parts.append(f"   - {num_open} preguntas Abiertas.")
    if num_fitb > 0: prompt_parts.append(f"   - {num_fitb} preguntas para Completar Espacios (usa '__BLANK__' para los espacios).") # <--- AÑADIDO
    
    prompt_parts.extend([
        "3. Coherencia y Claridad: Preguntas claras y apropiadas para la dificultad.",
        "4. Formato Opción Múltiple: 'correct_option_text' DEBE ser una de las cadenas en 'options'.",
        "5. Formato Completar Espacios: 'question_text_with_placeholders' debe usar '__BLANK__' para cada espacio a completar. 'correct_answers' debe ser una lista con las respuestas en el orden de los '__BLANK__'.", # <--- AÑADIDO
        "\nTexto de referencia para basar las preguntas:\n------\n", text_content, "\n------\n",
        "Responde ÚNICAMENTE con un objeto JSON que se adhiera al esquema proporcionado."
    ])
    prompt = "\n".join(prompt_parts)

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": simplified_response_schema, 
            "temperature": settings.EXAM_GEN_LLM_TEMPERATURE,
        }
    }
    
    effective_model_id = model_id_exam_gen or settings.DEFAULT_GEMINI_MODEL_EXAM_GEN
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{effective_model_id}:generateContent?key={settings.GEMINI_API_KEY_BACKEND}"

    logger.debug(f"ExamGen LLM (Full Exam): Enviando payload a Gemini ({effective_model_id}). Prompt (primeros 300 chars): {prompt[:300]}...")
    
    async with httpx.AsyncClient(timeout=settings.EXAM_GEN_LLM_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(api_url, json=payload)
            response.raise_for_status() 
            response_json = response.json()

            if (response_json.get("candidates") and response_json["candidates"][0].get("content") and
                response_json["candidates"][0]["content"].get("parts") and response_json["candidates"][0]["content"]["parts"][0].get("text")):
                json_text = response_json["candidates"][0]["content"]["parts"][0]["text"]
                logger.debug(f"ExamGen LLM (Full Exam): Raw JSON text from Gemini (primeros 1000 chars): {json_text[:1000]}...")

                # Intentar arreglar JSON incompleto
                last_brace = max(json_text.rfind('}'), json_text.rfind(']'))
                if last_brace != -1 and last_brace < len(json_text) - 1:
                    logger.warning(f"El JSON recibido parece estar cortado. Intentando recortar hasta el último cierre válido.")
                    json_text = json_text[:last_brace+1]

                try:
                    llm_questions = LLMGeneratedQuestions.model_validate_json(json_text)
                except Exception as e:
                    logger.error(f"Error al parsear el JSON del LLM. JSON recibido (recortado): {json_text[:1000]}...")
                    raise Exception("El modelo de IA devolvió una respuesta incompleta o inválida. Intenta con menos preguntas o vuelve a intentarlo.") from e

                # Loguear conteos
                if llm_questions.true_false_questions: logger.info(f"LLM Gen: {len(llm_questions.true_false_questions)} V/F")
                if llm_questions.multiple_choice_questions: logger.info(f"LLM Gen: {len(llm_questions.multiple_choice_questions)} MC")
                if llm_questions.open_questions: logger.info(f"LLM Gen: {len(llm_questions.open_questions)} Open")
                if llm_questions.fill_in_the_blank_questions: logger.info(f"LLM Gen: {len(llm_questions.fill_in_the_blank_questions)} FITB")

                return llm_questions
            else: 
                logger.error(f"ExamGen LLM (Full Exam): Solicitud bloqueada o estructura de respuesta inesperada. Respuesta: {response_json}")
                return None 
        except httpx.HTTPStatusError as e:
            logger.error(f"ExamGen LLM (Full Exam): HTTP error: {e.response.status_code} - {e.response.text}", exc_info=True)
            raise Exception(f"Error de la API de Gemini ({e.response.status_code}): {e.response.text}") from e
        except (json.JSONDecodeError, ValidationError) as e: 
            raw_text_response = "No disponible (error antes de obtener texto)"
            if 'response' in locals() and hasattr(response, 'text'): raw_text_response = response.text 
            logger.error(f"ExamGen LLM (Full Exam): Fallo al parsear/validar JSON. Error: {e}. Texto crudo: {raw_text_response}", exc_info=True)
            raise Exception("Error al procesar la respuesta del modelo de IA.") from e
        except Exception as e:
            logger.error(f"ExamGen LLM (Full Exam): Error inesperado: {e}", exc_info=True)
            raise Exception(f"Error inesperado contactando el servicio de IA: {str(e)}") from e

# --- Función para orquestar la generación del examen completo ---
async def generate_exam_questions_service(request: ExamGenerationRequest) -> GeneratedExam:
    logger.info(f"ExamGen Service (Full Exam): Iniciando para PDF ID: {request.pdf_id}, Título: '{request.title}'")
    error_message_for_user = None
    try:
        # Obtener número de preguntas de cada tipo desde la configuración de la solicitud
        num_vf = request.question_config.get("vf_questions", 0)
        num_mc = request.question_config.get("mc_questions", 0)
        num_open = request.question_config.get("open_questions", 0)
        num_fitb = request.question_config.get("fitb_questions", 0) # <--- NUEVO

        pdf_text_content = await get_pdf_content_for_exam_generation(
            request.pdf_id,
            request.user_id, 
            getattr(request, 'sample_text_from_pdf', None) 
        )
        
        min_text_length = settings.EXAM_GEN_MIN_TEXT_LENGTH
        if not pdf_text_content or len(pdf_text_content) < min_text_length :
            logger.warning(f"ExamGen Service (Full Exam): Contenido del PDF para {request.pdf_id} es muy corto o no disponible.")
            error_message_for_user = f"El contenido del documento es demasiado corto (longitud: {len(pdf_text_content or '')}) para generar un examen. Se requieren al menos {min_text_length} caracteres."
            return GeneratedExam(pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty, questions=[], error=error_message_for_user)

        llm_generated_data = await generate_questions_via_gemini_api(
            text_content=pdf_text_content,
            num_vf=num_vf,
            num_mc=num_mc,
            num_open=num_open,
            num_fitb=num_fitb, # <--- PASAR NUEVO PARÁMETRO
            difficulty=request.difficulty,
            language=request.language,
            model_id_exam_gen=request.model_id 
        )

        if not llm_generated_data:
            logger.error(f"ExamGen Service (Full Exam): No se recibieron datos del LLM para '{request.title}'.")
            error_message_for_user = "El modelo de IA no pudo generar las preguntas. Inténtalo de nuevo."
            return GeneratedExam(pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty, questions=[], error=error_message_for_user)

        all_questions_output: List[QuestionOutput] = [] 
        
        # Procesar preguntas V/F
        if llm_generated_data.true_false_questions:
            for q_data in llm_generated_data.true_false_questions:
                try:
                    all_questions_output.append(TrueFalseQuestionOutput(id=str(uuid.uuid4()), text=q_data.question_text, correct_answer=q_data.answer, explanation=q_data.explanation))
                except ValidationError as ve: logger.warning(f"ExamGen Service (Full Exam): Error validando V/F: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")
        
        # Procesar preguntas Opción Múltiple
        if llm_generated_data.multiple_choice_questions:
            for q_data in llm_generated_data.multiple_choice_questions:
                try:
                    if not q_data.options or len(q_data.options) < 2: continue
                    correct_idx = -1
                    try:
                        norm_opts = [opt.strip().lower() for opt in q_data.options]
                        norm_correct_text = q_data.correct_option_text.strip().lower()
                        correct_idx = norm_opts.index(norm_correct_text)
                    except ValueError: 
                        logger.warning(f"ExamGen Service (Full Exam): Respuesta OM '{q_data.correct_option_text}' no en opciones {q_data.options} para: '{q_data.question_text}'. Se omite.")
                        continue
                    all_questions_output.append(MultipleChoiceQuestionOutput(id=str(uuid.uuid4()), text=q_data.question_text, options=q_data.options, correct_answer_index=correct_idx, explanation=q_data.explanation))
                except ValidationError as ve: logger.warning(f"ExamGen Service (Full Exam): Error validando OM: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")
        
        # Procesar preguntas Abiertas
        if llm_generated_data.open_questions:
            for q_data in llm_generated_data.open_questions:
                try:
                    all_questions_output.append(OpenQuestionOutput(id=str(uuid.uuid4()), text=q_data.question_text, explanation=q_data.explanation_or_answer_guide))
                except ValidationError as ve: logger.warning(f"ExamGen Service (Full Exam): Error validando Abierta: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")

        # Procesar preguntas para Completar Espacios <--- NUEVO
        if llm_generated_data.fill_in_the_blank_questions:
            for q_data in llm_generated_data.fill_in_the_blank_questions:
                try:
                    if not q_data.correct_answers: # Debe tener al menos una respuesta
                        logger.warning(f"ExamGen Service (Full Exam): Pregunta FITB sin respuestas: '{q_data.question_text_with_placeholders}'. Se omite.")
                        continue
                    all_questions_output.append(FillInTheBlankQuestionOutput(
                        id=str(uuid.uuid4()), 
                        text=q_data.question_text_with_placeholders, 
                        answers=q_data.correct_answers, 
                        explanation=q_data.explanation
                    ))
                except ValidationError as ve: 
                    logger.warning(f"ExamGen Service (Full Exam): Error validando FITB: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")
        
        config_that_was_used = QuestionConfigForExam(
            num_true_false=num_vf, 
            num_multiple_choice=num_mc,
            num_open_questions=num_open,
            num_fill_in_the_blank=num_fitb, # <--- AÑADIDO
            difficulty=request.difficulty,
            language=request.language,
            model_id=request.model_id or settings.DEFAULT_GEMINI_MODEL_EXAM_GEN,
            user_id=request.user_id
        )

        return GeneratedExam(
            pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty,
            questions=all_questions_output, config_used=config_that_was_used, error=error_message_for_user
        )
    except Exception as e: 
        logger.error(f"ExamGen Service (Full Exam): Error inesperado generando examen '{request.title}': {e}", exc_info=True)
        return GeneratedExam(pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty, questions=[], error=f"Error interno: {str(e)}")

# --- Funciones para Regeneración de Preguntas (Adaptadas) ---

def _parse_dict_to_question_output(question_data: Dict[str, Any]) -> QuestionOutput:
    q_type_str = question_data.get("type") 
    if not q_type_str or not isinstance(q_type_str, str):
        raise ValueError(f"Campo 'type' es inválido o falta en question_data: {question_data}")

    # Mapeo de tipos del frontend/almacenados a los literales del enum QuestionType
    # Esto es crucial si los strings no coinciden exactamente con los valores del enum.
    type_map = {
        "V_F": QuestionType.TRUE_FALSE,
        "TRUE_FALSE": QuestionType.TRUE_FALSE, # Alias
        "MC": QuestionType.MULTIPLE_CHOICE,
        "MULTIPLE_CHOICE": QuestionType.MULTIPLE_CHOICE, # Alias
        "OPEN": QuestionType.OPEN,
        "FITB": QuestionType.FILL_IN_THE_BLANK, # <--- AÑADIDO
        "FILL_IN_THE_BLANK": QuestionType.FILL_IN_THE_BLANK # Alias
    }
    
    question_type_enum = type_map.get(q_type_str.upper())

    if not question_type_enum:
        raise ValueError(f"Tipo de pregunta desconocido '{q_type_str}' en question_data.")

    try:
        if "id" not in question_data: question_data["id"] = str(uuid.uuid4()) # Asegurar ID
        if "text" not in question_data or not question_data['text']: raise ValueError("Missing or empty 'text' field.")

        # Asignar el tipo enum correcto para la validación de Pydantic
        question_data_typed = {**question_data, "type": question_type_enum}


        if question_type_enum == QuestionType.TRUE_FALSE:
            return TrueFalseQuestionOutput(**question_data_typed)
        elif question_type_enum == QuestionType.MULTIPLE_CHOICE:
            return MultipleChoiceQuestionOutput(**question_data_typed)
        elif question_type_enum == QuestionType.OPEN:
            return OpenQuestionOutput(**question_data_typed)
        elif question_type_enum == QuestionType.FILL_IN_THE_BLANK: # <--- AÑADIDO
            return FillInTheBlankQuestionOutput(**question_data_typed)
        else: # No debería llegar aquí
            raise ValueError(f"Tipo de pregunta '{question_type_enum.value}' no manejado para parseo.")
    except ValidationError as ve:
        logger.error(f"Error de validación Pydantic al parsear dict a QuestionOutput (tipo intentado: {question_type_enum.value}). Error: {ve}. Datos: {question_data}", exc_info=True)
        raise ValueError(f"Datos de pregunta inválidos para tipo '{question_type_enum.value}': {str(ve)}") from ve

async def _call_gemini_for_single_question_regeneration(
    text_content: str,
    question_type_to_regenerate: QuestionType, # Usar el Enum
    original_question_text: str,
    existing_question_texts: List[str],
    difficulty: Literal["facil", "medio", "dificil"], # Usar Literal o tu Enum DifficultyLevel
    language: str, # Usar tu Enum Language
    model_id: str  # Usar tu Enum ModelChoice
) -> Optional[Dict[str, Any]]:
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("ExamGen LLM (Regen): GEMINI_API_KEY_BACKEND no está configurado.")
        raise ValueError("Clave API de Gemini no configurada para el backend.")

    single_question_response_schema: Dict[str, Any] = {"type": "OBJECT", "properties": {}}
    llm_type_description = ""

    if question_type_to_regenerate == QuestionType.TRUE_FALSE:
        llm_type_description = "Verdadero/Falso"
        single_question_response_schema["properties"] = {
            "question_text": {"type": "STRING"}, "answer": {"type": "BOOLEAN"}, "explanation": {"type": "STRING"}
        }
        single_question_response_schema["required"] = ["question_text", "answer"]
    elif question_type_to_regenerate == QuestionType.MULTIPLE_CHOICE:
        llm_type_description = "Opción Múltiple"
        single_question_response_schema["properties"] = {
            "question_text": {"type": "STRING"}, 
            "options": {"type": "ARRAY", "items": {"type": "STRING"}},
            "correct_option_text": {"type": "STRING"},
            "explanation": {"type": "STRING"}
        }
        single_question_response_schema["required"] = ["question_text", "options", "correct_option_text"]
    elif question_type_to_regenerate == QuestionType.OPEN:
        llm_type_description = "Abierta"
        single_question_response_schema["properties"] = {
            "question_text": {"type": "STRING"}, "explanation_or_answer_guide": {"type": "STRING"}
        }
        single_question_response_schema["required"] = ["question_text"]
    elif question_type_to_regenerate == QuestionType.FILL_IN_THE_BLANK: # <--- AÑADIDO
        llm_type_description = "Completar Espacios"
        single_question_response_schema["properties"] = {
            "question_text_with_placeholders": {"type": "STRING", "description": "Texto con placeholders como __BLANK__."},
            "correct_answers": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Lista de respuestas en orden."},
            "explanation": {"type": "STRING", "description": "Explicación (opcional)."}
        }
        single_question_response_schema["required"] = ["question_text_with_placeholders", "correct_answers"]
    else:
        logger.error(f"ExamGen LLM (Regen): Tipo de pregunta no soportado: {question_type_to_regenerate.value}")
        return None

    existing_questions_str = "\n".join([f"- '{q_text}'" for q_text in existing_question_texts]) if existing_question_texts else "Ninguna."

    prompt_parts = [
        f"Eres un asistente experto en crear preguntas de examen en idioma '{language}' con dificultad '{difficulty}'.",
        f"Tarea: Genera UNA NUEVA pregunta de tipo '{llm_type_description}'.",
        "Contexto del PDF para basar la pregunta:\n------\n", text_content, "\n------\n",
        "RESTRICCIONES IMPORTANTES:",
        f"1. La NUEVA pregunta DEBE SER SIGNIFICATIVAMENTE DIFERENTE a esta PREGUNTA ORIGINAL: '{original_question_text}'.",
        f"2. La NUEVA pregunta también debe ser diferente y NO REDUNDANTE con estas OTRAS PREGUNTAS YA EXISTENTES:\n{existing_questions_str}",
        "3. La NUEVA pregunta debe explorar un aspecto del texto no cubierto por las preguntas anteriores.",
        "4. Para Opción Múltiple: genera 3 o 4 opciones. 'correct_option_text' debe coincidir con una de las 'options'.",
        "5. Para Completar Espacios: usa '__BLANK__' para cada espacio. 'correct_answers' debe ser una lista con las respuestas en el orden de los '__BLANK__'.", # <--- AÑADIDO
        f"Responde ÚNICAMENTE con un objeto JSON que se adhiera al schema definido para una pregunta de tipo '{llm_type_description}'. No incluyas texto adicional fuera del JSON."
    ]
    prompt = "\n".join(prompt_parts)

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": single_question_response_schema,
            "temperature": settings.EXAM_GEN_LLM_TEMPERATURE, 
        }
    }
    
    # model_id ya es del tipo ModelChoice (enum) si viene de QuestionConfigForExam
    # o un string si viene de la request original. El schema de Gemini espera string.
    effective_model_id = model_id.value if hasattr(model_id, 'value') else model_id
    effective_model_id = effective_model_id or settings.DEFAULT_GEMINI_MODEL_EXAM_GEN

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{effective_model_id}:generateContent?key={settings.GEMINI_API_KEY_BACKEND}"

    logger.debug(f"ExamGen LLM (Regen): Enviando payload a Gemini ({effective_model_id}) para regenerar tipo '{question_type_to_regenerate.value}'. Prompt (primeros 300 chars): {prompt[:300]}...")

    async with httpx.AsyncClient(timeout=settings.EXAM_GEN_LLM_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(api_url, json=payload)
            response.raise_for_status()
            response_json = response.json()

            if (response_json.get("candidates") and response_json["candidates"][0].get("content") and
                response_json["candidates"][0]["content"].get("parts") and response_json["candidates"][0]["content"]["parts"][0].get("text")):
                json_text = response_json["candidates"][0]["content"]["parts"][0]["text"]
                logger.debug(f"ExamGen LLM (Regen): Raw JSON text from Gemini: {json_text}")
                return json.loads(json_text)
            else:
                logger.error(f"ExamGen LLM (Regen): Solicitud bloqueada o estructura de respuesta inesperada. Respuesta: {response_json}")
                return None
        except httpx.HTTPStatusError as e:
            logger.error(f"ExamGen LLM (Regen): HTTP error: {e.response.status_code} - {e.response.text}", exc_info=True)
            raise Exception(f"Error de API Gemini al regenerar ({e.response.status_code}): {e.response.text}") from e
        except (json.JSONDecodeError, ValidationError) as e: 
            raw_text_response = "No disponible"
            if 'response' in locals() and hasattr(response, 'text'): raw_text_response = response.text
            logger.error(f"ExamGen LLM (Regen): Fallo al parsear JSON de LLM. Error: {e}. Texto: {raw_text_response}", exc_info=True)
            raise Exception("Error procesando respuesta del modelo IA para regeneración.") from e
        except Exception as e:
            logger.error(f"ExamGen LLM (Regen): Error inesperado: {e}", exc_info=True)
            raise Exception(f"Error inesperado contactando servicio IA para regeneración: {str(e)}") from e

async def regenerate_one_question_service(request: RegenerateQuestionRequest) -> Optional[QuestionOutput]:
    logger.info(f"ExamGen Service (Regen): Iniciando regeneración para PDF ID: {request.pdf_id}, Pregunta Original ID: {request.question_to_regenerate.get('id', 'N/A')}")

    try:
        original_question_parsed = _parse_dict_to_question_output(request.question_to_regenerate)
        
        existing_questions_parsed: List[QuestionOutput] = []
        if request.existing_questions:
            for q_data in request.existing_questions:
                if q_data.get("id") != original_question_parsed.id: 
                    try:
                        existing_questions_parsed.append(_parse_dict_to_question_output(q_data))
                    except ValueError as ve_parse:
                        logger.warning(f"ExamGen Service (Regen): Omitiendo pregunta existente (ID: {q_data.get('id')}) por error de parseo: {ve_parse}")
        
        existing_question_texts = [q.text for q in existing_questions_parsed]

        pdf_text_content = await get_pdf_content_for_exam_generation(request.pdf_id, request.exam_config.user_id)
        min_text_length = settings.EXAM_GEN_MIN_TEXT_LENGTH 
        if not pdf_text_content or len(pdf_text_content) < min_text_length:
            logger.error(f"ExamGen Service (Regen): Contenido del PDF para {request.pdf_id} es muy corto (longitud: {len(pdf_text_content or '')}) o no disponible.")
            raise ValueError(f"Contenido del PDF es insuficiente para regenerar la pregunta (requerido: {min_text_length} chars).")

        context_for_llm = pdf_text_content[:10000] # Ajusta según necesidad y límites del modelo

        llm_generated_single_q_data = await _call_gemini_for_single_question_regeneration(
            text_content=context_for_llm,
            question_type_to_regenerate=original_question_parsed.type, # Pasa el QuestionType Enum
            original_question_text=original_question_parsed.text,
            existing_question_texts=existing_question_texts,
            difficulty=request.exam_config.difficulty, # Ya es Enum
            language=request.exam_config.language,     # Ya es Enum
            model_id=request.exam_config.model_id      # Ya es Enum o None
        )

        if not llm_generated_single_q_data:
            logger.error(f"ExamGen Service (Regen): LLM no devolvió datos para regenerar la pregunta (PDF: {request.pdf_id}).")
            raise RuntimeError("El modelo de IA no pudo regenerar la pregunta.")

        regenerated_question_output: Optional[QuestionOutput] = None
        new_question_id = str(uuid.uuid4()) 
        q_type_to_parse_llm = original_question_parsed.type # Este es el QuestionType Enum
        
        try:
            if q_type_to_parse_llm == QuestionType.TRUE_FALSE:
                llm_q = LLMGeneratedTrueFalse(**llm_generated_single_q_data)
                regenerated_question_output = TrueFalseQuestionOutput(
                    id=new_question_id, text=llm_q.question_text, 
                    correct_answer=llm_q.answer, explanation=llm_q.explanation,
                    type=QuestionType.TRUE_FALSE 
                )
            elif q_type_to_parse_llm == QuestionType.MULTIPLE_CHOICE:
                llm_q = LLMGeneratedMultipleChoice(**llm_generated_single_q_data)
                correct_idx = -1
                try:
                    norm_opts_llm = [opt.strip().lower() for opt in llm_q.options]
                    norm_correct_text_llm = llm_q.correct_option_text.strip().lower()
                    correct_idx = norm_opts_llm.index(norm_correct_text_llm)
                except ValueError:
                    logger.error(f"ExamGen Service (Regen): Texto de opción correcta '{llm_q.correct_option_text}' (del LLM) no en opciones '{llm_q.options}'. Datos LLM: {llm_generated_single_q_data}")
                    raise ValueError("Respuesta del LLM para opción múltiple es inválida: la opción correcta no coincide.")

                regenerated_question_output = MultipleChoiceQuestionOutput(
                    id=new_question_id, text=llm_q.question_text,
                    options=llm_q.options, correct_answer_index=correct_idx, explanation=llm_q.explanation,
                    type=QuestionType.MULTIPLE_CHOICE
                )
            elif q_type_to_parse_llm == QuestionType.OPEN:
                llm_q = LLMGeneratedOpenQuestion(**llm_generated_single_q_data)
                regenerated_question_output = OpenQuestionOutput(
                    id=new_question_id, text=llm_q.question_text, 
                    explanation=llm_q.explanation_or_answer_guide,
                    type=QuestionType.OPEN
                )
            elif q_type_to_parse_llm == QuestionType.FILL_IN_THE_BLANK: # <--- AÑADIDO
                llm_q = LLMGeneratedFillInTheBlank(**llm_generated_single_q_data)
                regenerated_question_output = FillInTheBlankQuestionOutput(
                    id=new_question_id,
                    text=llm_q.question_text_with_placeholders,
                    answers=llm_q.correct_answers,
                    explanation=llm_q.explanation,
                    type=QuestionType.FILL_IN_THE_BLANK
                )
            else: 
                logger.error(f"ExamGen Service (Regen): Tipo de pregunta desconocido '{q_type_to_parse_llm.value}' en transformación final.")
                raise ValueError(f"Tipo de pregunta no manejado: {q_type_to_parse_llm.value}")

        except ValidationError as ve:
            logger.error(f"ExamGen Service (Regen): Error Pydantic al parsear respuesta LLM para tipo '{q_type_to_parse_llm.value}'. Error: {ve}. Datos LLM: {llm_generated_single_q_data}", exc_info=True)
            raise ValueError(f"Respuesta LLM para tipo '{q_type_to_parse_llm.value}' no tiene formato esperado: {str(ve)}")

        if regenerated_question_output:
            logger.info(f"ExamGen Service (Regen): Pregunta regenerada (Nuevo ID: {new_question_id}) para PDF: {request.pdf_id}")
            return regenerated_question_output
        else:
            logger.error(f"ExamGen Service (Regen): Fallo al mapear respuesta LLM a QuestionOutput. Datos LLM: {llm_generated_single_q_data}")
            raise RuntimeError("Error interno al transformar la pregunta regenerada.")

    except ValueError as ve: 
        logger.warning(f"ExamGen Service (Regen): ValueError (PDF: {request.pdf_id}): {str(ve)}", exc_info=True)
        raise ve 
    except RuntimeError as rte: 
        logger.error(f"ExamGen Service (Regen): RuntimeError (PDF: {request.pdf_id}): {str(rte)}", exc_info=True)
        raise rte 
    except Exception as e: 
        logger.error(f"ExamGen Service (Regen): Error inesperado (PDF: {request.pdf_id}): {e}", exc_info=True)
        raise RuntimeError(f"Error interno inesperado al regenerar la pregunta: {str(e)}")

