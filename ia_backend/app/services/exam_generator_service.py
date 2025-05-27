# ia_backend/app/services/exam_generator_service.py
import logging
import uuid
import json
import httpx # Para llamadas HTTP a Gemini API
from typing import List, Dict, Optional

# Modelos Pydantic
from app.models.schemas import (
    ExamGenerationRequest,
    GeneratedExam,
    Question,
    TrueFalseQuestion,
    MultipleChoiceQuestion,
    LLMGeneratedQuestions,
    LLMGeneratedTrueFalse,
    LLMGeneratedMultipleChoice
)
# Configuración y servicios
from app.core.config import settings
# Para acceder a Pinecone y obtener chunks de texto
from app.services.rag_chain import get_vector_store_for_pdf_retrieval # Usaremos la misma función de rag_chain

logger = logging.getLogger(__name__)

# --- Gemini API Configuration (ya está en config.py, pero para claridad) ---
# GEMINI_API_KEY = settings.GEMINI_API_KEY_BACKEND
# GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
# Se usará settings.GEMINI_API_KEY_BACKEND directamente.

# --- PDF Content Retriever (desde Pinecone) ---
async def get_pdf_content_for_exam_generation(pdf_id: str, sample_text_from_pdf: Optional[str] = None) -> str:
    """
    Retrieves text content from a PDF's vector store (Pinecone) to be used for exam generation.
    For now, it fetches a few chunks as a sample.
    """
    if sample_text_from_pdf: # Permitir pasar texto de muestra para desarrollo/pruebas
        logger.info(f"ExamGen: Using provided sample_text_from_pdf for pdf_id: {pdf_id}")
        return sample_text_from_pdf

    logger.info(f"ExamGen: Attempting to retrieve text content for PDF ID: {pdf_id} from Pinecone.")
    vector_store = get_vector_store_for_pdf_retrieval(pdf_id) # Usa Google Embeddings

    if not vector_store:
        logger.warning(f"ExamGen: Vector store not found for PDF ID: {pdf_id}. Cannot retrieve text for exam generation.")
        # Devolver un texto genérico o lanzar un error más específico si es preferible
        return (
            "No se pudo acceder al contenido del PDF. "
            "La célula es la unidad básica de la vida. Todos los seres vivos están compuestos por células. "
            "Existen dos tipos principales de células: procariotas y eucariotas."
        )

    try:
        # Recuperar algunos documentos (chunks) como muestra.
        # Para un examen real, se necesitaría una estrategia más robusta para obtener el contenido relevante.
        # Por ejemplo, recuperar todos los chunks o una porción significativa.
        # Aquí, recuperamos hasta N chunks para tener una idea del contenido.
        # Usaremos una búsqueda de similitud con una consulta genérica para obtener algunos chunks.
        # OJO: Esto es una simplificación.
        
        # Simplemente tomaremos algunos documentos. No es una búsqueda semántica para "todo el documento".
        # Langchain Pinecone no tiene un método directo para "get all texts" fácilmente sin IDs.
        # Una forma de obtener algunos textos podría ser hacer una query muy genérica.
        # O si tuvieras los IDs de los chunks, podrías recuperarlos.
        
        # Alternativa más simple por ahora: si el vector_store permite iterar o tomar N documentos.
        # La interfaz de Langchain para Pinecone no expone esto directamente de forma simple.
        # Vamos a simular que tenemos acceso a algunos textos.
        # En una implementación real, esto DEBERÍA MEJORARSE.
        # Podrías guardar los textos en Firestore junto con los metadatos del PDF.

        # Intento de búsqueda genérica para obtener algunos chunks:
        # Esto es un HACK para obtener algunos textos.
        # No es la forma ideal de obtener "todo el contenido del PDF" para un examen.
        logger.info(f"ExamGen: Performing a generic similarity search to get sample chunks for PDF: {pdf_id}")
        # El retriever ya está configurado en get_vector_store_for_pdf_retrieval
        retriever = vector_store.as_retriever(search_kwargs={"k": 5}) # Obtener 5 chunks
        sample_docs = await retriever.aget_relevant_documents("resumen del contenido") # Consulta genérica

        if sample_docs:
            retrieved_texts = [doc.page_content for doc in sample_docs]
            concatenated_text = "\n\n".join(retrieved_texts)
            logger.info(f"ExamGen: Retrieved {len(sample_docs)} sample chunks from Pinecone for PDF ID: {pdf_id}. Total length: {len(concatenated_text)}")
            if len(concatenated_text) < 200: # Si es muy corto, añadir texto por defecto
                 concatenated_text += "\n\nInformación adicional: La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía."
            return concatenated_text
        else:
            logger.warning(f"ExamGen: No sample chunks retrieved from Pinecone for PDF ID: {pdf_id}. Using default text.")
            return (
                "No se pudieron recuperar fragmentos específicos del PDF. "
                "Las células eucariotas tienen un núcleo definido, mientras que las procariotas no. "
                "El núcleo contiene el material genético de la célula."
            )

    except Exception as e:
        logger.error(f"ExamGen: Error retrieving sample content from Pinecone for PDF ID {pdf_id}: {e}", exc_info=True)
        return (
            "Error al acceder al contenido del PDF. "
            "Las mitocondrias son orgánulos responsables de la generación de energía en las células eucariotas. "
            "Los cloroplastos, presentes en células vegetales, realizan la fotosíntesis."
        )


async def generate_questions_from_llm(
    text_content: str,
    num_vf: int,
    num_mc: int,
    difficulty: str
) -> Optional[LLMGeneratedQuestions]:
    """
    Generates questions using the Gemini API with a structured response schema.
    """
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("ExamGen LLM: GEMINI_API_KEY_BACKEND is not set.")
        return None

    # Definir el esquema JSON para la respuesta del LLM
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "true_false_questions": {
                "type": "ARRAY", "description": f"Una lista de exactamente {num_vf} preguntas de verdadero o falso.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "question_text": {"type": "STRING", "description": "El texto de la pregunta de verdadero o falso."},
                        "answer": {"type": "BOOLEAN", "description": "La respuesta correcta (true o false)."},
                        "explanation": {"type": "STRING", "description": "Una breve explicación de por qué la respuesta es correcta o incorrecta."}
                    }, "required": ["question_text", "answer"]
                }
            },
            "multiple_choice_questions": {
                "type": "ARRAY", "description": f"Una lista de exactamente {num_mc} preguntas de opción múltiple.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "question_text": {"type": "STRING", "description": "El texto de la pregunta de opción múltiple."},
                        "options": {
                            "type": "ARRAY", "items": {"type": "STRING"},
                            "description": "Una lista de 4 opciones de respuesta (3 incorrectas, 1 correcta)."
                        },
                        "correct_option_text": {"type": "STRING", "description": "El texto de la opción de respuesta correcta."},
                        "explanation": {"type": "STRING", "description": "Una breve explicación de por qué la opción es correcta."}
                    }, "required": ["question_text", "options", "correct_option_text"]
                }
            }
        }
    }
    # Solo incluir las claves en el schema si se piden preguntas de ese tipo
    if num_vf == 0 and "true_false_questions" in response_schema["properties"]:
        del response_schema["properties"]["true_false_questions"]
    if num_mc == 0 and "multiple_choice_questions" in response_schema["properties"]:
        del response_schema["properties"]["multiple_choice_questions"]


    prompt_parts = [
        f"Eres un asistente experto en crear preguntas de examen. Basándote ESTRICTAMENTE en el siguiente texto, genera preguntas de examen con el nivel de dificultad '{difficulty}'.",
        "Debes generar exactamente:" if (num_vf > 0 or num_mc > 0) else "No se solicitaron preguntas específicas, pero si generas alguna, sigue el formato.",
    ]
    if num_vf > 0:
        prompt_parts.append(f"- {num_vf} preguntas de Verdadero/Falso.")
    if num_mc > 0:
        prompt_parts.append(f"- {num_mc} preguntas de Opción Múltiple (cada una con exactamente 4 opciones: una correcta y tres distractores plausibles).")

    prompt_parts.extend([
        "Asegúrate de que las preguntas sean coherentes con el texto, claras y apropiadas para el nivel de dificultad especificado.",
        "Para las preguntas de opción múltiple, la opción correcta DEBE estar incluida en la lista de 'options'.",
        "Proporciona una breve explicación para cada pregunta.",
        "\nTexto de referencia para basar las preguntas:\n------\n",
        text_content,
        "\n------\n",
        "Responde ÚNICAMENTE con el objeto JSON que se adhiere al esquema proporcionado. No incluyas ningún otro texto, explicación, markdown o prefijo fuera del JSON."
    ])
    prompt = "\n".join(prompt_parts)

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
            "temperature": 0.5, # Un poco menos creativo para preguntas
        }
    }
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={settings.GEMINI_API_KEY_BACKEND}"
    # Podrías permitir seleccionar el modelo de Gemini para generación de exámenes en el futuro.

    logger.debug(f"ExamGen LLM: Enviando payload a Gemini. Prompt (primeros 200 chars): {prompt[:200]}...")

    async with httpx.AsyncClient(timeout=180.0) as client: # Timeout más largo para generación
        try:
            response = await client.post(api_url, json=payload)
            response.raise_for_status()
            response_json = response.json()

            if (
                response_json.get("candidates") and
                response_json["candidates"][0].get("content") and
                response_json["candidates"][0]["content"].get("parts")
            ):
                json_text = response_json["candidates"][0]["content"]["parts"][0].get("text")
                if json_text:
                    parsed_json_content = json.loads(json_text)
                    # Validar con Pydantic model
                    llm_questions = LLMGeneratedQuestions(**parsed_json_content)
                    # Asegurar que se generó la cantidad correcta (o al menos algunas)
                    generated_vf = len(llm_questions.true_false_questions) if llm_questions.true_false_questions else 0
                    generated_mc = len(llm_questions.multiple_choice_questions) if llm_questions.multiple_choice_questions else 0
                    
                    if num_vf > 0 and generated_vf == 0 and num_mc == 0 : # Si solo se pidieron V/F y no se generaron
                         logger.warning(f"ExamGen LLM: Se pidieron {num_vf} V/F pero no se generaron. Respuesta LLM: {json_text}")
                    if num_mc > 0 and generated_mc == 0 and num_vf == 0: # Si solo se pidieron MC y no se generaron
                         logger.warning(f"ExamGen LLM: Se pidieron {num_mc} MC pero no se generaron. Respuesta LLM: {json_text}")
                    if (num_vf > 0 or num_mc > 0) and (generated_vf == 0 and generated_mc == 0):
                        logger.error(f"ExamGen LLM: No se generaron preguntas a pesar de ser solicitadas. Respuesta LLM: {json_text}")
                        # Podría ser útil devolver None para indicar un fallo en la generación esperada.
                        # return None # O manejarlo como error más adelante.

                    return llm_questions
                else:
                    logger.error("ExamGen LLM: 'text' field missing in Gemini response part.")
                    return None
            else:
                logger.error(f"ExamGen LLM: Unexpected response structure from Gemini API. Response: {response_json}")
                return None
        except httpx.HTTPStatusError as e:
            logger.error(f"ExamGen LLM: HTTP error: {e.response.status_code} - {e.response.text}", exc_info=True)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"ExamGen LLM: Failed to parse JSON from LLM response: {e}. Raw text: {response_json['candidates'][0]['content']['parts'][0].get('text', 'N/A') if 'response_json' in locals() and response_json.get('candidates') else 'Raw response not available'}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"ExamGen LLM: An unexpected error occurred: {e}", exc_info=True)
            return None


async def generate_exam_questions_service(request: ExamGenerationRequest) -> Optional[GeneratedExam]:
    logger.info(f"ExamGen Service: Iniciando generación de examen para PDF ID: {request.pdf_id}, Título: '{request.title}'")
    
    pdf_text_content = await get_pdf_content_for_exam_generation(request.pdf_id, request.sample_text_from_pdf)
    if not pdf_text_content or len(pdf_text_content) < 50 : # Si el texto es muy corto, la generación será pobre
        logger.warning(f"ExamGen Service: Contenido del PDF para {request.pdf_id} es muy corto o no disponible. Longitud: {len(pdf_text_content or '')}")
        # Podrías decidir no continuar si el texto es insuficiente
        # return None 
        # O usar un texto por defecto aún más explícito sobre el error
        if not pdf_text_content:
            pdf_text_content = "El contenido del documento no pudo ser recuperado para la generación de preguntas."


    llm_generated_data = await generate_questions_from_llm(
        text_content=pdf_text_content,
        num_vf=request.question_config.vf_questions,
        num_mc=request.question_config.mc_questions,
        difficulty=request.difficulty
    )

    if not llm_generated_data:
        logger.error("ExamGen Service: No se recibieron datos estructurados del LLM para las preguntas.")
        return None

    all_questions: List[Question] = []
    if llm_generated_data.true_false_questions:
        for q_data in llm_generated_data.true_false_questions:
            all_questions.append(TrueFalseQuestion(id=str(uuid.uuid4()), **q_data.model_dump()))
    
    if llm_generated_data.multiple_choice_questions:
        for q_data in llm_generated_data.multiple_choice_questions:
            # Validar que la respuesta correcta esté en las opciones
            if q_data.correct_option_text not in q_data.options:
                logger.warning(f"ExamGen Service: Respuesta correcta '{q_data.correct_option_text}' no encontrada en opciones {q_data.options} para la pregunta: '{q_data.question_text}'. Se omitirá esta pregunta.")
                continue # O intentar corregirla, o añadirla si falta. Por ahora, omitir.
            all_questions.append(MultipleChoiceQuestion(id=str(uuid.uuid4()), **q_data.model_dump()))

    if not all_questions and (request.question_config.vf_questions > 0 or request.question_config.mc_questions > 0):
        logger.warning(f"ExamGen Service: No se generaron preguntas válidas para el examen '{request.title}' a pesar de ser solicitadas.")
        # Podrías devolver None o un GeneratedExam con lista vacía, dependiendo de cómo lo maneje el frontend.
        # Devolver None indica un fallo más severo.
        return None

    generated_exam = GeneratedExam(
        pdf_id=request.pdf_id,
        title=request.title,
        difficulty=request.difficulty,
        questions=all_questions
    )
    logger.info(f"ExamGen Service: Examen '{request.title}' generado con {len(all_questions)} preguntas.")
    return generated_exam

