# ia_backend/app/services/exam_generator_service.py
import logging
import uuid
import json
import httpx # Para llamadas HTTP a Gemini API
import os
from typing import List, Dict, Optional, Union, Literal

from pydantic import ValidationError

# Modelos Pydantic
from app.models.schemas import (
    ExamGenerationRequest,    # Solicitud del frontend
    GeneratedExam,            # Respuesta al frontend
    Question,                 # Union de tipos de pregunta para la respuesta
    TrueFalseQuestion,        # Modelo de pregunta V/F para la respuesta
    MultipleChoiceQuestion,   # Modelo de pregunta OM para la respuesta
    LLMGeneratedQuestions,    # Estructura que esperamos del LLM
    LLMGeneratedTrueFalse,
    LLMGeneratedMultipleChoice
)
# Configuración y servicios
from app.core.config import settings
# Para acceder a Pinecone y obtener chunks de texto
from app.services.rag_chain import get_vector_store_for_pdf_retrieval 

logger = logging.getLogger(__name__)

async def get_pdf_content_for_exam_generation(pdf_id: str, sample_text_from_pdf: Optional[str] = None) -> str:
    """
    Retrieves text content from a PDF.
    1. Uses provided sample_text_from_pdf if available (for dev/testing).
    2. Tries to load a pre-extracted full text file.
    3. Falls back to retrieving chunks from Pinecone.
    """
    if sample_text_from_pdf:
        logger.info(f"ExamGen: Using provided sample_text_from_pdf for pdf_id: {pdf_id}")
        return sample_text_from_pdf

    processed_data_dir = settings.PROCESSED_DATA_DIR
    txt_file_path = os.path.join(processed_data_dir, f"{pdf_id}_full_text.txt")
    
    if os.path.exists(txt_file_path):
        logger.info(f"ExamGen: Found full text file at {txt_file_path}.")
        try:
            with open(txt_file_path, "r", encoding="utf-8") as f:
                full_text = f.read()
            if full_text.strip():
                logger.info(f"ExamGen: Loaded full text from file, length: {len(full_text)}.")
                max_text_for_llm_from_file = settings.EXAM_GEN_MAX_TEXT_FROM_FILE
                if len(full_text) > max_text_for_llm_from_file:
                    logger.warning(f"ExamGen: Full text from file for PDF {pdf_id} is too long ({len(full_text)} chars), truncating to {max_text_for_llm_from_file} chars.")
                    return full_text[:max_text_for_llm_from_file]
                return full_text
        except Exception as e:
            logger.error(f"ExamGen: Error reading full text file {txt_file_path}: {e}")

    logger.info(f"ExamGen: Full text file not found or empty for {pdf_id}. Attempting to retrieve from Pinecone.")
    
    vector_store = get_vector_store_for_pdf_retrieval(pdf_id) 

    if not vector_store:
        logger.warning(f"ExamGen: Vector store not found for PDF ID: {pdf_id} via rag_chain. Cannot retrieve text.")
        return (
            "No se pudo acceder al contenido del PDF para generar el examen. "
            "Por favor, asegúrese de que el documento haya sido procesado correctamente. "
            "Intente de nuevo o contacte al soporte si el problema persiste."
        )

    try:
        num_chunks_to_retrieve = settings.EXAM_GEN_NUM_CHUNKS_RETRIEVAL
        logger.info(f"ExamGen: Performing similarity search to get up to {num_chunks_to_retrieve} sample chunks for PDF: {pdf_id}")
        
        retriever = vector_store.as_retriever(search_kwargs={"k": num_chunks_to_retrieve})
        sample_docs = await retriever.aget_relevant_documents("conceptos e información detallada del documento") 

        if sample_docs:
            retrieved_texts = [doc.page_content for doc in sample_docs]
            concatenated_text = "\n\n---\n\n".join(retrieved_texts)
            logger.info(f"ExamGen: Retrieved {len(sample_docs)} chunks from Pinecone for PDF ID: {pdf_id}. Total length: {len(concatenated_text)}")
            
            max_text_for_llm_from_pinecone = settings.EXAM_GEN_MAX_TEXT_FROM_PINECONE
            if len(concatenated_text) > max_text_for_llm_from_pinecone:
                logger.warning(f"ExamGen: Concatenated text from Pinecone for PDF {pdf_id} is too long ({len(concatenated_text)} chars), truncating to {max_text_for_llm_from_pinecone} chars.")
                return concatenated_text[:max_text_for_llm_from_pinecone]
            return concatenated_text
        else:
            logger.warning(f"ExamGen: No sample chunks retrieved from Pinecone for PDF ID: {pdf_id}.")
            return "No se pudieron recuperar fragmentos específicos del PDF desde la base de datos vectorial para la generación del examen."

    except Exception as e:
        logger.error(f"ExamGen: Error retrieving content from Pinecone for PDF ID {pdf_id}: {e}", exc_info=True)
        return "Ocurrió un error al acceder al contenido del PDF para la generación del examen."


async def generate_questions_via_gemini_api(
    text_content: str,
    num_vf: int,
    num_mc: int,
    difficulty: Literal["facil", "medio", "dificil"],
    language: str,
    model_id_exam_gen: str
) -> Optional[LLMGeneratedQuestions]:
    # CORRECCIÓN: Usar settings.GEMINI_API_KEY_BACKEND
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("ExamGen LLM: GEMINI_API_KEY_BACKEND is not set in settings.")
        # Devolver None o lanzar una excepción más específica podría ser mejor aquí
        # para que generate_exam_questions_service pueda dar un error más claro al usuario.
        raise ValueError("La clave API de Gemini para el backend no está configurada.")


    simplified_response_schema = {"type": "OBJECT", "properties": {}}
    if num_vf > 0:
        simplified_response_schema["properties"]["true_false_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_vf} preguntas V/F.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question_text": {"type": "STRING"}, "answer": {"type": "BOOLEAN"}, "explanation": {"type": "STRING"}
                }, "required": ["question_text", "answer"]
            }
        }
    if num_mc > 0:
        simplified_response_schema["properties"]["multiple_choice_questions"] = {
            "type": "ARRAY", "description": f"Lista de {num_mc} preguntas OM.",
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

    if not simplified_response_schema["properties"]:
        logger.info("ExamGen LLM: No questions requested (num_vf=0, num_mc=0). Skipping LLM call.")
        return LLMGeneratedQuestions(true_false_questions=[], multiple_choice_questions=[])

    prompt_parts = [
        f"Eres un asistente experto en crear preguntas de examen en idioma '{language}' con un nivel de dificultad '{difficulty}'. Basándote ESTRICTAMENTE en el siguiente texto, genera preguntas de examen.",
        "Debes generar exactamente:"
    ]
    if num_vf > 0:
        prompt_parts.append(f"- {num_vf} preguntas de Verdadero/Falso.")
    if num_mc > 0:
        prompt_parts.append(f"- {num_mc} preguntas de Opción Múltiple (cada una con 3 a 4 opciones: una correcta y las demás distractores plausibles).")

    prompt_parts.extend([
        "Asegúrate de que las preguntas sean coherentes con el texto, claras y apropiadas para el nivel de dificultad especificado.",
        "Para las preguntas de opción múltiple, la 'correct_option_text' DEBE ser una de las cadenas en la lista 'options'.",
        "Proporciona una breve 'explanation' (opcional pero recomendada) para cada pregunta.",
        "\nTexto de referencia para basar las preguntas:\n------\n",
        text_content,
        "\n------\n",
        "Responde ÚNICAMENTE con un objeto JSON que se adhiera al esquema proporcionado. No incluyas ningún otro texto, explicación, markdown o prefijo fuera del JSON."
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
    
    effective_model_id = model_id_exam_gen
    # CORRECCIÓN: Usar settings.GEMINI_API_KEY_BACKEND
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{effective_model_id}:generateContent?key={settings.GEMINI_API_KEY_BACKEND}"

    logger.debug(f"ExamGen LLM: Enviando payload a Gemini ({effective_model_id}). Prompt (primeros 200 chars): {prompt[:200]}...")
    
    async with httpx.AsyncClient(timeout=settings.EXAM_GEN_LLM_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(api_url, json=payload)
            response.raise_for_status() 
            response_json = response.json()

            if (
                response_json.get("candidates") and
                response_json["candidates"][0].get("content") and
                response_json["candidates"][0]["content"].get("parts") and
                response_json["candidates"][0]["content"]["parts"][0].get("text")
            ):
                json_text = response_json["candidates"][0]["content"]["parts"][0]["text"]
                logger.debug(f"ExamGen LLM: Raw JSON text from Gemini: {json_text}")
                
                llm_questions = LLMGeneratedQuestions.model_validate_json(json_text)
                
                generated_vf_count = len(llm_questions.true_false_questions) if llm_questions.true_false_questions else 0
                generated_mc_count = len(llm_questions.multiple_choice_questions) if llm_questions.multiple_choice_questions else 0
                
                log_msg_counts = f"LLM generó: V/F={generated_vf_count} (pedidas={num_vf}), OM={generated_mc_count} (pedidas={num_mc})."
                if (num_vf > 0 and generated_vf_count == 0 and num_mc == 0) or \
                   (num_mc > 0 and generated_mc_count == 0 and num_vf == 0) or \
                   (num_vf > 0 and num_mc > 0 and generated_vf_count == 0 and generated_mc_count == 0) or \
                   (num_vf > 0 and generated_vf_count < num_vf) or \
                   (num_mc > 0 and generated_mc_count < num_mc) :
                    logger.warning(f"ExamGen LLM: No se generó la cantidad esperada o ninguna pregunta. {log_msg_counts} Respuesta LLM: {json_text}")
                else:
                    logger.info(f"ExamGen LLM: Preguntas generadas exitosamente. {log_msg_counts}")
                return llm_questions
            else: 
                prompt_feedback = response_json.get("promptFeedback")
                block_reason_msg = "Razón desconocida o no especificada por la API."
                if prompt_feedback and prompt_feedback.get("blockReason"):
                    block_reason = prompt_feedback["blockReason"]
                    block_message_detail = prompt_feedback.get("blockReasonMessage", "")
                    block_reason_msg = f"Razón: {block_reason}. Mensaje: {block_message_detail if block_message_detail else 'No disponible.'}"
                logger.error(f"ExamGen LLM: Solicitud bloqueada o estructura de respuesta inesperada. {block_reason_msg} Respuesta completa: {response_json}")
                return None # Indicar fallo
        except httpx.HTTPStatusError as e:
            logger.error(f"ExamGen LLM: HTTP error: {e.response.status_code} - {e.response.text}", exc_info=True)
            # Propagar un error más específico si es posible
            raise Exception(f"Error de la API de Gemini ({e.response.status_code}): {e.response.text}") from e
        except (json.JSONDecodeError, ValidationError) as e: 
            raw_text_response = "No disponible (error antes de obtener texto)"
            if 'response' in locals() and hasattr(response, 'text'): # type: ignore
                raw_text_response = response.text # type: ignore
            logger.error(f"ExamGen LLM: Fallo al parsear/validar JSON de respuesta LLM: {e}. Texto crudo: {raw_text_response}", exc_info=True)
            raise Exception("Error al procesar la respuesta del modelo de IA.") from e
        except Exception as e:
            logger.error(f"ExamGen LLM: Error inesperado durante llamada a Gemini: {e}", exc_info=True)
            raise Exception(f"Error inesperado contactando el servicio de IA: {str(e)}") from e


async def generate_exam_questions_service(request: ExamGenerationRequest) -> GeneratedExam:
    logger.info(f"ExamGen Service: Iniciando generación de examen para PDF ID: {request.pdf_id}, Título: '{request.title}'")
    
    error_message_for_user = None
    try:
        pdf_text_content = await get_pdf_content_for_exam_generation(
            request.pdf_id, 
            getattr(request, 'sample_text_from_pdf', None)
        )
        
        min_text_length = settings.EXAM_GEN_MIN_TEXT_LENGTH
        if not pdf_text_content or len(pdf_text_content) < min_text_length :
            logger.warning(f"ExamGen Service: Contenido del PDF para {request.pdf_id} es muy corto (longitud: {len(pdf_text_content or '')}) o no disponible.")
            error_message_for_user = (
                f"El contenido del documento recuperado es demasiado corto (longitud: {len(pdf_text_content or '')} caracteres) "
                f"para generar un examen de calidad. Se requieren al menos {min_text_length} caracteres."
            )
            return GeneratedExam(
                pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty,
                questions=[], error=error_message_for_user
            )

        llm_generated_data = await generate_questions_via_gemini_api(
            text_content=pdf_text_content,
            num_vf=request.question_config.vf_questions,
            num_mc=request.question_config.mc_questions,
            difficulty=request.difficulty,
            language=request.language,
            model_id_exam_gen=request.model_id or settings.DEFAULT_GEMINI_MODEL_EXAM_GEN
        )

        if not llm_generated_data:
            logger.error(f"ExamGen Service: No se recibieron datos estructurados del LLM para el examen '{request.title}'.")
            error_message_for_user = "El modelo de IA no pudo generar las preguntas del examen. Inténtalo de nuevo o con diferentes configuraciones."
            return GeneratedExam(
                pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty,
                questions=[], error=error_message_for_user
            )

        all_questions: List[Question] = []
        
        if llm_generated_data.true_false_questions:
            for q_data in llm_generated_data.true_false_questions:
                try:
                    all_questions.append(TrueFalseQuestion(id=str(uuid.uuid4()), question_text=q_data.question_text, correct_answer=q_data.answer, explanation=q_data.explanation))
                except ValidationError as ve:
                    logger.warning(f"ExamGen Service: Error de validación al crear TrueFalseQuestion: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")

        if llm_generated_data.multiple_choice_questions:
            for q_data in llm_generated_data.multiple_choice_questions:
                try:
                    if not q_data.options or len(q_data.options) < 2: 
                        logger.warning(f"ExamGen Service: Pregunta OM '{q_data.question_text}' tiene opciones insuficientes. Se omite.")
                        continue
                    
                    correct_idx = -1
                    try:
                        normalized_options = [opt.strip().lower() for opt in q_data.options]
                        normalized_correct_option_text = q_data.correct_option_text.strip().lower()
                        correct_idx = normalized_options.index(normalized_correct_option_text)
                    except ValueError:
                        logger.warning(f"ExamGen Service: Respuesta correcta '{q_data.correct_option_text}' no encontrada en opciones {q_data.options} para pregunta: '{q_data.question_text}'. Se omite.")
                        continue
                    
                    all_questions.append(MultipleChoiceQuestion(id=str(uuid.uuid4()), question_text=q_data.question_text, options=q_data.options, correct_answer_index=correct_idx, explanation=q_data.explanation))
                except ValidationError as ve:
                     logger.warning(f"ExamGen Service: Error de validación al crear MultipleChoiceQuestion: {ve}. Datos: {q_data.model_dump_json(exclude_none=True)}")

        if not all_questions and (request.question_config.vf_questions > 0 or request.question_config.mc_questions > 0):
            logger.warning(f"ExamGen Service: No se generaron preguntas válidas para el examen '{request.title}' a pesar de ser solicitadas y de que el LLM pudo haber respondido.")
            error_message_for_user = "El modelo de IA generó una respuesta, pero no se pudieron validar o parsear preguntas válidas. Revisa los logs del backend para más detalles."
            # No necesariamente un error si el LLM no devuelve nada y no hubo excepción.
            # El frontend mostrará "no hay preguntas".
        
        return GeneratedExam(
            pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty,
            questions=all_questions, error=error_message_for_user # error será None si todo fue bien
        )

    except Exception as e: # Captura errores de get_pdf_content o generate_questions_via_gemini_api
        logger.error(f"ExamGen Service: Error inesperado generando examen '{request.title}': {e}", exc_info=True)
        return GeneratedExam(
            pdf_id=request.pdf_id, title=request.title, difficulty=request.difficulty,
            questions=[], error=f"Ocurrió un error interno inesperado al generar el examen: {str(e)}"
        )

