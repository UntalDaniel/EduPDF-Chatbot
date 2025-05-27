# ia_backend/app/main.py
import logging
import os
from typing import List, Dict, Any # Asegúrate que Any y List están importados de typing
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body, Depends, Query # Asegúrate que Query está importado
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

# Importaciones de servicios y modelos de la aplicación
# Cambiado process_pdf_content a process_pdf_from_storage_url
from app.services.pdf_processor import process_pdf_from_storage_url, process_uploaded_pdf, get_pdf_metadata_from_db, list_user_pdfs_from_db
from app.services.rag_chain import get_rag_response, get_vector_store_for_pdf, delete_pdf_vector_store
from app.services.feedback_service import save_feedback # Asumiendo que tienes este servicio
# NUEVAS IMPORTACIONES PARA EXÁMENES
from app.services.exam_generator_service import generate_exam_questions_service


from app.models.schemas import (
    PDFProcessRequest,
    PDFProcessResponse,
    QueryRequest,
    QueryResponse,
    FeedbackRequest,
    FeedbackResponse,
    # NUEVOS SCHEMAS PARA EXÁMENES
    ExamGenerationRequest,
    GeneratedExam
)
from app.core.config import settings # Importar la configuración

# Configuración de logging
logging.basicConfig(level=settings.LOG_LEVEL.upper()) # Usar el nivel de log de la configuración
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Backend para EduPDF Chatbot, incluyendo procesamiento de PDF, RAG y generación de exámenes."
)

# Configuración de CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip() for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    logger.warning("CORS origins not configured. Allowing all origins. This is not recommended for production.")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# --- Endpoints existentes de tu main.py ---

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": f"Welcome to {settings.PROJECT_NAME} v{settings.PROJECT_VERSION}"}

@app.post("/process-pdf-url/", response_model=PDFProcessResponse, tags=["PDF Processing"])
async def process_pdf_from_url(request: PDFProcessRequest):
    logger.info(f"Processing PDF from URL for user {request.user_id}, pdf_id {request.pdf_id}")
    try:
        # Llamada a la función renombrada/correcta
        result = await process_pdf_from_storage_url(request.pdf_id, request.user_id, file_url=request.file_url)
        return PDFProcessResponse(message=result["message"], pdf_id=result["pdf_id"])
    except Exception as e:
        logger.error(f"Error processing PDF from URL {request.file_url}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-pdf/", response_model=PDFProcessResponse, tags=["PDF Processing"])
async def upload_and_process_pdf(
    user_id: str = Form(...),
    pdf_id: str = Form(...), 
    file: UploadFile = File(...)
):
    logger.info(f"Uploading PDF for user_id: {user_id}, pdf_id: {pdf_id}")
    try:
        result = await process_uploaded_pdf(file, user_id, pdf_id)
        return PDFProcessResponse(message=result["message"], pdf_id=result["pdf_id"])
    except HTTPException as http_exc:
        logger.error(f"HTTPException during PDF upload for user {user_id}: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error during PDF upload for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.get("/pdfs/{user_id}/", response_model=List[Dict[str, Any]], tags=["PDF Processing"])
async def list_user_pdfs(user_id: str):
    logger.info(f"Listing PDFs for user_id: {user_id}")
    try:
        pdfs = await list_user_pdfs_from_db(user_id)
        return pdfs
    except Exception as e:
        logger.error(f"Error listing PDFs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve PDF list.")

@app.delete("/pdfs/{pdf_id}/", tags=["PDF Processing"])
async def delete_pdf(pdf_id: str, user_id: str = Query(...)): 
    logger.info(f"Attempting to delete PDF with id: {pdf_id} for user: {user_id}")
    try:
        await delete_pdf_vector_store(pdf_id) 
        # Aquí deberías añadir la lógica para eliminar los metadatos del PDF de Firestore también.
        # Ejemplo: await delete_pdf_metadata_from_firestore(pdf_id, user_id)
        logger.info(f"Successfully deleted vector store for PDF: {pdf_id}. Firestore deletion pending implementation.")
        return {"message": f"PDF {pdf_id} and its associated vector data deleted successfully. Ensure Firestore metadata is also handled."}
    except Exception as e:
        logger.error(f"Error deleting PDF {pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete PDF {pdf_id}: {str(e)}")


@app.post("/query-pdf/", response_model=QueryResponse, tags=["RAG Querying"])
async def query_pdf(request: QueryRequest):
    logger.info(f"Querying PDF ID: {request.pdf_id} with query: '{request.query}'")
    try:
        answer, source_chunks = await get_rag_response(
            pdf_id=request.pdf_id,
            query_text=request.query,
            chat_history=request.chat_history,
        )
        if answer is None:
            raise HTTPException(status_code=404, detail="Could not generate an answer or PDF not found.")
        return QueryResponse(answer=answer, source_chunks=source_chunks)
    except FileNotFoundError as e:
        logger.warning(f"PDF not found for query: {request.pdf_id}. Error: {e}")
        raise HTTPException(status_code=404, detail=f"Vector store for PDF ID '{request.pdf_id}' not found. Has it been processed?")
    except Exception as e:
        logger.error(f"Error querying PDF {request.pdf_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing your query: {str(e)}")

@app.post("/feedback/", response_model=FeedbackResponse, tags=["Feedback"])
async def submit_feedback(request: FeedbackRequest):
    logger.info(f"Received feedback for pdf_id: {request.pdf_id}, query: '{request.query}', helpful: {request.is_helpful}")
    try:
        feedback_id = await save_feedback(request)
        return FeedbackResponse(message="Feedback submitted successfully", feedback_id=feedback_id)
    except Exception as e:
        logger.error(f"Error saving feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save feedback.")

# --- NUEVO ENDPOINT PARA GENERACIÓN DE EXÁMENES ---
@app.post("/exams/generate-questions", response_model=GeneratedExam, tags=["Exams"])
async def api_generate_exam_questions(
    request: ExamGenerationRequest = Body(...) 
):
    logger.info(f"Received request to generate exam for PDF ID: {request.pdf_id}, Title: {request.title}")
    logger.debug(f"Question Config: {request.question_config}, Difficulty: {request.difficulty}")
    
    try:
        generated_exam_data = await generate_exam_questions_service(request)

        if not generated_exam_data or not generated_exam_data.questions:
            logger.warning(f"Exam generation for PDF {request.pdf_id} resulted in no questions.")
            raise HTTPException(
                status_code=500, 
                detail="No se pudieron generar las preguntas del examen con la configuración proporcionada."
            )
        
        logger.info(f"Successfully generated {len(generated_exam_data.questions)} questions for exam '{generated_exam_data.title}'.")
        return generated_exam_data
        
    except Exception as e:
        logger.error(f"Error during exam generation for PDF {request.pdf_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Ocurrió un error interno al generar el examen: {str(e)}"
        )

# --- Main execution (para desarrollo local) ---
if __name__ == "__main__":
    logger.info(f"Starting Uvicorn server on host {settings.HOST} and port {settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=int(settings.PORT), 
        reload=settings.RELOAD,
        log_level=settings.LOG_LEVEL.lower() 
    )
