# ia_backend/app/main.py
import logging
import os 
from typing import List, Dict, Any, Optional, Union # Asegúrate que Union esté importado
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body, Depends, Query 
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv # No es estrictamente necesario si config.py ya lo hace, pero no daña.
import uvicorn

# Importaciones de servicios y modelos de la aplicación
from app.services.pdf_processor import (
    # process_pdf_from_storage_url, # Descomenta si tienes este endpoint
    process_uploaded_pdf, 
    list_user_pdfs_from_db, 
    delete_pdf_from_firestore_and_storage 
)
from app.services.rag_chain import get_rag_response, delete_pdf_vector_store_namespace
from app.services.feedback_service import save_feedback 
# Servicios de examen
from app.services.exam_generator_service import (
    generate_exam_questions_service,
    regenerate_one_question_service # <--- NUEVA IMPORTACIÓN
)


from app.models.schemas import (
    # PDFProcessRequest, 
    PDFProcessResponse,
    # QueryRequest, 
    QueryResponse,   
    ChatRequestBody, 
    ChatResponse,    
    FeedbackRequest,
    FeedbackResponse,
    ExamGenerationRequestFrontend as ExamGenerationRequest, # Usando el alias definido en el servicio
    GeneratedExamResponse as GeneratedExam,                 # Usando el alias definido en el servicio
    # --- NUEVAS IMPORTACIONES DE SCHEMAS ---
    RegenerateQuestionRequest,
    QuestionOutput, # El Union de los tipos de pregunta de salida
    TrueFalseQuestionOutput,
    MultipleChoiceQuestionOutput,
    OpenQuestionOutput
)
from app.core.config import settings 

logging.basicConfig(level=settings.LOG_LEVEL.upper()) 
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Backend para EduPDF Chatbot, incluyendo procesamiento de PDF, RAG y generación de exámenes."
)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip() for origin in settings.BACKEND_CORS_ORIGINS if str(origin).strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    logger.warning("CORS origins not configured in settings. Allowing all origins. This is NOT recommended for production.")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], 
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# --- Endpoints ---

@app.get("/", tags=["General"])
async def root():
    logger.info("Root endpoint accessed")
    return {"message": f"Welcome to {settings.PROJECT_NAME} v{settings.PROJECT_VERSION}"}

# @app.post("/process-pdf-url/", response_model=PDFProcessResponse, tags=["PDF Processing"])
# async def process_pdf_from_url_endpoint(request: PDFProcessRequest):
#     # ... (tu código existente)

@app.post("/upload-pdf/", response_model=PDFProcessResponse, tags=["PDF Processing"])
async def upload_and_process_pdf_endpoint(
    user_id: str = Form(...),
    pdf_id: str = Form(...), 
    file: UploadFile = File(...)
):
    # ... (tu código existente para este endpoint)
    logger.info(f"Uploading PDF for user_id: {user_id}, pdf_id: {pdf_id}, filename: {file.filename}")
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo PDF no tiene nombre.")
    if not file.content_type == "application/pdf":
         raise HTTPException(status_code=400, detail="El archivo no es un PDF válido.")
    try:
        result = await process_uploaded_pdf(file, user_id, pdf_id) 
        return PDFProcessResponse(message=result.get("message", "Error procesando PDF subido."), pdf_id=result.get("pdf_id", pdf_id), filename=file.filename, status=result.get("status", "unknown"))
    except HTTPException as http_exc:
        logger.error(f"HTTPException during PDF upload for user {user_id}: {http_exc.detail}")
        raise http_exc
    except RuntimeError as r_err: 
        logger.error(f"RuntimeError during PDF upload for user {user_id}: {r_err}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(r_err))
    except Exception as e:
        logger.error(f"Unexpected error during PDF upload for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Un error inesperado ocurrió: {str(e)}")

@app.get("/pdfs/{user_id}/", response_model=List[Dict[str, Any]], tags=["PDF Management"])
async def list_user_pdfs_endpoint(user_id: str): 
    # ... (tu código existente para este endpoint)
    logger.info(f"Listing PDFs for user_id: {user_id}")
    try:
        pdfs = list_user_pdfs_from_db(user_id) 
        return pdfs
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fallo al recuperar la lista de PDFs.")

@app.delete("/pdfs/{pdf_id}/", status_code=200, tags=["PDF Management"]) 
async def delete_pdf_endpoint(pdf_id: str, user_id: str = Query(..., description="ID del usuario propietario del PDF para verificación.")): 
    # ... (tu código existente para este endpoint, asegurándote que las llamadas a servicios sean correctas)
    logger.info(f"Attempting to delete PDF with id: {pdf_id} for user: {user_id}")
    try:
        pinecone_deleted = delete_pdf_vector_store_namespace(pdf_id) 
        if pinecone_deleted:
            logger.info(f"Successfully deleted vector store namespace '{pdf_id}' from Pinecone.")
        else:
            logger.warning(f"Could not confirm deletion of vector store namespace '{pdf_id}' from Pinecone or it didn't exist.")

        db_storage_deleted = await delete_pdf_from_firestore_and_storage(pdf_id, user_id)
        if not db_storage_deleted:
            logger.warning(f"Failed to delete PDF metadata/storage for pdf_id: {pdf_id} by user: {user_id}.")
            
        return {"message": f"Solicitud de eliminación para PDF {pdf_id} procesada. Verifique los logs para detalles."}
    except PermissionError as pe: 
        logger.error(f"Permission denied for deleting PDF {pdf_id} by user {user_id}: {pe}")
        raise HTTPException(status_code=403, detail=str(pe))
    except HTTPException: 
        raise
    except Exception as e:
        logger.error(f"Error deleting PDF {pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Fallo al eliminar PDF {pdf_id}: {str(e)}")

# @app.post("/query-pdf/", response_model=QueryResponse, tags=["RAG Querying"]) 
# async def query_pdf_endpoint(request: QueryRequest): 
#     # ... (tu código existente)

@app.post("/chat-rag/{pdf_id}/", response_model=ChatResponse, tags=["RAG Querying"])
async def chat_rag_endpoint(
    pdf_id: str,
    request_body: ChatRequestBody
):
    # ... (tu código existente para este endpoint)
    logger.info(f"Chat RAG request for PDF ID: {pdf_id}, User question: '{request_body.user_question}'")
    try:
        response_obj = await get_rag_response(
            pdf_id=pdf_id,
            query_text=request_body.user_question,
            chat_history_from_frontend=[msg.model_dump() for msg in request_body.chat_history] if request_body.chat_history else None,
            language=request_body.language or 'es',
            model_id=request_body.model_id
        )
        if response_obj.error:
             if "embeddings model not initialized" in response_obj.error.lower() or "servicio de ia no está configurado" in response_obj.error.lower():
                 raise HTTPException(status_code=503, detail=response_obj.error)
             raise HTTPException(status_code=500, detail=response_obj.error)
        return response_obj
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in RAG chat for PDF {pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en el chat RAG: {str(e)}")


@app.post("/feedback/", response_model=FeedbackResponse, tags=["Feedback"])
async def submit_feedback_endpoint(request: FeedbackRequest): 
    # ... (tu código existente para este endpoint)
    logger.info(f"Received feedback for pdf_id: {request.pdf_id}, query: '{request.query}', helpful: {request.is_helpful}")
    try:
        feedback_id = await save_feedback(request) 
        return FeedbackResponse(message="Feedback submitted successfully", feedback_id=feedback_id)
    except Exception as e:
        logger.error(f"Error saving feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fallo al guardar feedback.")

@app.post("/exams/generate-questions", response_model=GeneratedExam, tags=["Exams"])
async def api_generate_exam_questions_endpoint( 
    request: ExamGenerationRequest = Body(...) # Usando el alias para el tipo de request
    # El schema ExamGenerationRequest (alias de ExamGenerationRequestFrontend) incluye 'user_id: str',
    # por lo que FastAPI validará automáticamente su presencia.
):
    logger.info(f"Received request to generate exam for PDF ID: {request.pdf_id}, Title: '{request.title}'")
    # El user_id estará disponible en request.user_id si el frontend lo envía correctamente.
    logger.debug(f"Question Config from frontend: {request.question_config}, Difficulty: {request.difficulty}, Language: {request.language}, Model: {request.model_id}, UserID: {request.user_id}")
    
    try:
        generated_exam_data = await generate_exam_questions_service(request)

        if generated_exam_data is None: 
            logger.error(f"Exam generation service returned None for PDF {request.pdf_id}.")
            raise HTTPException(status_code=500, detail="El servicio de generación de exámenes no pudo completar la solicitud.")
        
        if generated_exam_data.error:
            logger.warning(f"Error during exam generation for PDF {request.pdf_id}: {generated_exam_data.error}")
            status_code = 500 
            if "contenido del documento recuperado es demasiado corto" in generated_exam_data.error.lower(): status_code = 400 
            elif "modelo de ia no pudo generar" in generated_exam_data.error.lower(): status_code = 502 
            raise HTTPException(status_code=status_code, detail=generated_exam_data.error)

        if not generated_exam_data.questions and (request.question_config.get("vf_questions",0) > 0 or request.question_config.get("mc_questions",0) > 0 or request.question_config.get("open_questions",0) > 0) :
            logger.warning(f"Exam generation for PDF {request.pdf_id} resulted in no valid questions despite being requested.")
        
        logger.info(f"Successfully generated {len(generated_exam_data.questions)} questions for exam '{generated_exam_data.title}'.")
        return generated_exam_data
        
    except HTTPException: 
        raise
    except Exception as e: 
        logger.error(f"Unexpected error during exam generation for PDF {request.pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ocurrió un error interno inesperado al generar el examen: {str(e)}")


# --- NUEVO ENDPOINT PARA REGENERAR PREGUNTA ESPECÍFICA ---
@app.post(
    "/exams/regenerate-question/", 
    response_model=QuestionOutput, # El tipo de respuesta es una única pregunta (Union de los tipos de salida)
    tags=["Exams"],
    summary="Regenerate a Specific Exam Question",
    description="Regenerates a single exam question based on PDF content, the original question, exam configuration, and other existing questions to ensure diversity."
)
async def regenerate_specific_question_endpoint(
    request: RegenerateQuestionRequest # El schema de la solicitud que definimos
):
    logger.info(f"Received request to regenerate specific question for PDF ID: {request.pdf_id}, Original Q ID: {request.question_to_regenerate.get('id', 'N/A')}")
    try:
        regenerated_question = await regenerate_one_question_service(request)

        if not regenerated_question:
            logger.error(f"Question regeneration failed for PDF ID: {request.pdf_id}. Service returned no question.")
            raise HTTPException(status_code=500, detail="El modelo de IA no pudo regenerar la pregunta o ocurrió un error interno.")
        
        logger.info(f"Successfully regenerated question (New ID: {regenerated_question.id}) for PDF ID: {request.pdf_id}")
        return regenerated_question # Devuelve la pregunta regenerada

    except ValueError as ve: # Errores de validación o lógica de negocio (ej. PDF corto, datos inválidos)
        logger.warning(f"Validation error during specific question regeneration for PDF ID {request.pdf_id}: {str(ve)}", exc_info=True)
        raise HTTPException(status_code=422, detail=str(ve)) # Unprocessable Entity
    except RuntimeError as rte: # Errores críticos del servicio (ej. fallo del LLM)
        logger.error(f"Runtime error during specific question regeneration for PDF ID {request.pdf_id}: {str(rte)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(rte))
    except Exception as e: # Otros errores inesperados
        logger.error(f"Unexpected error in regenerate_specific_question_endpoint for PDF {request.pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno inesperado al regenerar la pregunta: {str(e)}")


if __name__ == "__main__":
    host_to_run = getattr(settings, "HOST", "127.0.0.1")
    port_to_run = int(getattr(settings, "PORT", 8000))
    reload_flag_run = getattr(settings, "RELOAD", True)
    log_level_str_run = getattr(settings, "LOG_LEVEL", "info").lower()

    logger.info(f"Starting Uvicorn server on host {host_to_run} and port {port_to_run}, reload: {reload_flag_run}, log_level: {log_level_str_run}")
    uvicorn.run(
        "main:app", 
        host=host_to_run,
        port=port_to_run, 
        reload=reload_flag_run,
        log_level=log_level_str_run
    )
