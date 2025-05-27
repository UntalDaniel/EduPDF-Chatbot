# ia_backend/app/main.py
import logging
import os 
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body, Depends, Query 
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv # No es estrictamente necesario si config.py ya lo hace, pero no daña.
import uvicorn

# Importaciones de servicios y modelos de la aplicación
from app.services.pdf_processor import (
    # process_pdf_from_storage_url, # Descomenta si tienes este endpoint
    process_uploaded_pdf, 
    list_user_pdfs_from_db, # Asegúrate que esta función exista y sea síncrona si la llamas sin await
    delete_pdf_from_firestore_and_storage 
)
# CORRECCIÓN DE IMPORTACIÓN Y LLAMADA:
from app.services.rag_chain import get_rag_response, delete_pdf_vector_store_namespace # Importar la función
# from app.services.rag_chain import get_vector_store_for_pdf_retrieval # Descomenta si la usas directamente aquí

from app.services.feedback_service import save_feedback 
from app.services.exam_generator_service import generate_exam_questions_service


from app.models.schemas import (
    # PDFProcessRequest, # Descomenta si usas process_pdf_from_storage_url_endpoint
    PDFProcessResponse,
    # QueryRequest, # Descomenta si usas query_pdf_endpoint
    QueryResponse,   
    ChatRequestBody, 
    ChatResponse,    
    FeedbackRequest,
    FeedbackResponse,
    ExamGenerationRequest, 
    GeneratedExam          
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
#     logger.info(f"Processing PDF from URL for user {request.user_id}, pdf_id {request.pdf_id}, url: {request.file_url}")
#     try:
#         result = await process_pdf_from_storage_url(
#             pdf_id=request.pdf_id, 
#             user_id=request.user_id, 
#             file_url=request.file_url
#         )
#         return PDFProcessResponse(message=result.get("message", "Error processing PDF."), pdf_id=result.get("pdf_id", request.pdf_id), filename=result.get("filename"))
#     except Exception as e:
#         logger.error(f"Error processing PDF from URL {request.file_url}: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=f"Error procesando PDF desde URL: {str(e)}")

@app.post("/upload-pdf/", response_model=PDFProcessResponse, tags=["PDF Processing"])
async def upload_and_process_pdf_endpoint(
    user_id: str = Form(...),
    pdf_id: str = Form(...), 
    file: UploadFile = File(...)
):
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
    except RuntimeError as r_err: # Capturar el RuntimeError de embeddings no disponibles
        logger.error(f"RuntimeError during PDF upload for user {user_id}: {r_err}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(r_err))
    except Exception as e:
        logger.error(f"Unexpected error during PDF upload for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Un error inesperado ocurrió: {str(e)}")

@app.get("/pdfs/{user_id}/", response_model=List[Dict[str, Any]], tags=["PDF Management"])
async def list_user_pdfs_endpoint(user_id: str): # Cambiado a async si list_user_pdfs_from_db es async
    logger.info(f"Listing PDFs for user_id: {user_id}")
    try:
        # Si list_user_pdfs_from_db es síncrona (como está ahora en pdf_processor.py)
        pdfs = list_user_pdfs_from_db(user_id) 
        # Si la hicieras async en pdf_processor.py, entonces:
        # pdfs = await list_user_pdfs_from_db(user_id) 
        return pdfs
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fallo al recuperar la lista de PDFs.")

@app.delete("/pdfs/{pdf_id}/", status_code=200, tags=["PDF Management"]) 
async def delete_pdf_endpoint(pdf_id: str, user_id: str = Query(..., description="ID del usuario propietario del PDF para verificación.")): 
    logger.info(f"Attempting to delete PDF with id: {pdf_id} for user: {user_id}")
    try:
        # CORRECCIÓN: Llamada síncrona a la función importada
        pinecone_deleted = delete_pdf_vector_store_namespace(pdf_id) 
        if pinecone_deleted:
            logger.info(f"Successfully deleted vector store namespace '{pdf_id}' from Pinecone.")
        else:
            logger.warning(f"Could not confirm deletion of vector store namespace '{pdf_id}' from Pinecone or it didn't exist.")

        db_storage_deleted = await delete_pdf_from_firestore_and_storage(pdf_id, user_id)
        if not db_storage_deleted:
            logger.warning(f"Failed to delete PDF metadata/storage for pdf_id: {pdf_id} by user: {user_id}.")
            # Considerar si esto debería ser un error que impida el 200 OK.
            # Por ahora, si Pinecone se borró, se considera un éxito parcial.

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
#     logger.info(f"Querying PDF ID: {request.pdf_id} with query: '{request.query}' by user: {request.user_id}")
#     try:
#         chat_response_obj = await get_rag_response(
#             pdf_id=request.pdf_id,
#             query_text=request.query,
#             chat_history_from_frontend=request.chat_history, 
#             user_id=request.user_id,
#         )

#         if chat_response_obj.error or not chat_response_obj.answer:
#             detail = chat_response_obj.error or "No se pudo generar una respuesta o PDF no encontrado."
#             status = 404 if "not found" in detail.lower() else 500
#             raise HTTPException(status_code=status, detail=detail)

#         source_chunks_for_response: Optional[List[Dict[str, Any]]] = None
#         if chat_response_obj.sources:
#             source_chunks_for_response = [
#                 {"page_content": doc.page_content, "metadata": doc.metadata} for doc in chat_response_obj.sources
#             ]
        
#         return QueryResponse(answer=chat_response_obj.answer, source_chunks=source_chunks_for_response)

#     except FileNotFoundError as e: 
#         logger.warning(f"Recurso no encontrado para query: {request.pdf_id}. Error: {e}") 
#         raise HTTPException(status_code=404, detail=f"Vector store para PDF ID '{request.pdf_id}' no encontrado. ¿Ha sido procesado?")
#     except HTTPException: 
#         raise
#     except Exception as e:
#         logger.error(f"Error querying PDF {request.pdf_id}: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=f"Error procesando tu consulta: {str(e)}")

@app.post("/chat-rag/{pdf_id}/", response_model=ChatResponse, tags=["RAG Querying"])
async def chat_rag_endpoint(
    pdf_id: str,
    request_body: ChatRequestBody
):
    logger.info(f"Chat RAG request for PDF ID: {pdf_id}, User question: '{request_body.user_question}'")
    try:
        response_obj = await get_rag_response(
            pdf_id=pdf_id,
            query_text=request_body.user_question,
            chat_history_from_frontend=[msg.model_dump() for msg in request_body.chat_history] if request_body.chat_history else None,
            language=request_body.language or 'es',
            model_id=request_body.model_id # El servicio usará un default si es None
        )
        if response_obj.error:
             # Si el error es por embeddings no inicializados, podría ser un 503 Service Unavailable
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
    logger.info(f"Received feedback for pdf_id: {request.pdf_id}, query: '{request.query}', helpful: {request.is_helpful}")
    try:
        feedback_id = await save_feedback(request) 
        return FeedbackResponse(message="Feedback submitted successfully", feedback_id=feedback_id)
    except Exception as e:
        logger.error(f"Error saving feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fallo al guardar feedback.")

@app.post("/exams/generate-questions", response_model=GeneratedExam, tags=["Exams"])
async def api_generate_exam_questions_endpoint( 
    request: ExamGenerationRequest = Body(...) 
):
    logger.info(f"Received request to generate exam for PDF ID: {request.pdf_id}, Title: '{request.title}'")
    logger.debug(f"Question Config: {request.question_config}, Difficulty: {request.difficulty}, Language: {request.language}, Model: {request.model_id}")
    
    try:
        generated_exam_data = await generate_exam_questions_service(request)

        if generated_exam_data is None: 
            logger.error(f"Exam generation service returned None for PDF {request.pdf_id}.")
            raise HTTPException(
                status_code=500, 
                detail="El servicio de generación de exámenes no pudo completar la solicitud."
            )
        
        if generated_exam_data.error:
            logger.warning(f"Error during exam generation for PDF {request.pdf_id}: {generated_exam_data.error}")
            status_code = 500 
            if "contenido del documento recuperado es demasiado corto" in generated_exam_data.error.lower():
                status_code = 400 
            elif "modelo de ia no pudo generar" in generated_exam_data.error.lower():
                status_code = 502 
            
            raise HTTPException(status_code=status_code, detail=generated_exam_data.error)

        if not generated_exam_data.questions and (request.question_config.vf_questions > 0 or request.question_config.mc_questions > 0):
            logger.warning(f"Exam generation for PDF {request.pdf_id} resulted in no valid questions despite being requested.")
        
        logger.info(f"Successfully generated {len(generated_exam_data.questions)} questions for exam '{generated_exam_data.title}'.")
        return generated_exam_data
        
    except HTTPException: 
        raise
    except Exception as e: 
        logger.error(f"Unexpected error during exam generation for PDF {request.pdf_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Ocurrió un error interno inesperado al generar el examen: {str(e)}"
        )

if __name__ == "__main__":
    host_to_run = getattr(settings, "HOST", "127.0.0.1")
    port_to_run = int(getattr(settings, "PORT", 8000))
    reload_flag_run = getattr(settings, "RELOAD", True)
    log_level_str_run = getattr(settings, "LOG_LEVEL", "info").lower()

    logger.info(f"Starting Uvicorn server on host {host_to_run} and port {port_to_run}, reload: {reload_flag_run}, log_level: {log_level_str_run}")
    uvicorn.run(
        "main:app", # Asegúrate que 'main' sea el nombre de este archivo (main.py)
        host=host_to_run,
        port=port_to_run, 
        reload=reload_flag_run,
        log_level=log_level_str_run
    )
