# ia_backend/app/main.py
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Depends, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any, Tuple # Asegúrate que Tuple esté aquí

# Asegúrate que MessageInput esté importado y que los otros esquemas también lo estén.
from app.models.schemas import ChatResponse, ProcessPdfRequest, ChatRequestBody, MessageInput 
from app.services import pdf_processor
from app.services import rag_chain

# Importar la excepción específica de Google
from google.api_core import exceptions as google_exceptions


# --- Inicialización de FastAPI ---
app = FastAPI(
    title="EduPDF IA Backend",
    description="Servicio de IA para procesamiento de PDF y chat RAG con EduPDF.",
    version="0.1.0"
)

# --- Configuración de CORS ---
origins = [
    "http://localhost:5173",
    "https://chatbot-pdf-7076d.firebaseapp.com",
    "https://chatbot-pdf-7076d.web.app"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependencia para cargar el índice FAISS ---
async def get_vector_store_for_path(pdf_id_from_path: str = Path(..., alias="pdf_id_param", description="The ID of the PDF to load FAISS index for")) -> pdf_processor.FAISS:
    print(f"get_vector_store_for_path llamado con pdf_id: '{pdf_id_from_path}' (tipo: {type(pdf_id_from_path)})")
    if not pdf_id_from_path or not isinstance(pdf_id_from_path, str):
        print(f"Error en get_vector_store_for_path: pdf_id_from_path es inválido: {pdf_id_from_path}")
        raise HTTPException(status_code=400, detail="pdf_id_from_path es inválido en la dependencia.")

    vector_store = await pdf_processor.load_faiss_index(pdf_id_from_path)
    if not vector_store:
        print(f"Índice FAISS no encontrado para pdf_id: {pdf_id_from_path} en get_vector_store_for_path.")
        raise HTTPException(
            status_code=404,
            detail=f"Índice para PDF '{pdf_id_from_path}' no encontrado. Procese el PDF primero."
        )
    print(f"Índice FAISS para {pdf_id_from_path} cargado exitosamente por la dependencia.")
    return vector_store


# --- Endpoints de la API ---

@app.get("/")
async def read_root():
    return {"message": "Bienvenido al Backend de IA de EduPDF"}

@app.post("/process-pdf/", status_code=202)
async def process_pdf_endpoint(
    pdf_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF.")
    
    try:
        pdf_content_bytes = await file.read()
        if not pdf_content_bytes:
            raise HTTPException(status_code=400, detail="Archivo PDF vacío o no se pudo leer.")

        await pdf_processor.process_pdf_and_create_index(pdf_id, pdf_content_bytes)
        
        return {"message": f"PDF '{file.filename}' (ID: {pdf_id}) recibido y programado para procesamiento. El índice estará disponible pronto."}
    except ValueError as ve:
        print(f"Error de valor al procesar PDF {pdf_id}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Error general al procesar PDF {pdf_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al procesar el PDF: {str(e)}")
    finally:
        if file and hasattr(file, 'is_closed') and not file.is_closed():
             await file.close()


@app.post("/chat-rag/{pdf_id_param}/", response_model=ChatResponse)
async def chat_with_pdf_rag(
    pdf_id_param: str = Path(..., title="The ID of the PDF to chat with", min_length=1),
    request_body: ChatRequestBody = Body(...),
    vector_store: pdf_processor.FAISS = Depends(get_vector_store_for_path)
):
    print(f"Endpoint /chat-rag/ llamado para pdf_id_param: '{pdf_id_param}'")
    print(f"Cuerpo de la solicitud (request_body): user_question='{request_body.user_question}', language='{request_body.language}', model_id='{request_body.model_id}', history_len={len(request_body.chat_history or [])}")

    try:
        chain = rag_chain.get_conversational_rag_chain(
            vector_store,
            model_id=request_body.model_id,
            chat_history_messages=request_body.chat_history 
        )
        
        formatted_history_for_invoke: List[Tuple[str, str]] = []
        if request_body.chat_history:
            temp_history = request_body.chat_history
            current_pair_user_content: Optional[str] = None
            for msg_input in temp_history:
                # Solo añadir al historial para el CONDENSE_QUESTION_PROMPT si no es un error guardado previamente
                if isinstance(msg_input.content, str) and "Error al procesar la pregunta" in msg_input.content and "429" in msg_input.content:
                    # Omitir mensajes de error de la API del historial que se pasa al prompt de condensación
                    if msg_input.role == 'user' and current_pair_user_content is not None: 
                        # Si un mensaje de usuario quedó colgado antes de un error del bot, no formar par.
                        current_pair_user_content = None
                    continue 

                if msg_input.role == 'user':
                    current_pair_user_content = msg_input.content
                elif msg_input.role == 'assistant' and current_pair_user_content is not None:
                    formatted_history_for_invoke.append((current_pair_user_content, msg_input.content))
                    current_pair_user_content = None # Reset for next pair
        
        print(f"Historial formateado para chain.ainvoke (lista de tuplas): {formatted_history_for_invoke}")

        response = await rag_chain.query_rag_chain(
            chain, 
            request_body.user_question,
            formatted_history_for_invoke, 
            request_body.language
        )
        return response

    # **CORRECCIÓN: Capturar ResourceExhausted específicamente**
    except google_exceptions.ResourceExhausted as rate_limit_error:
        print(f"Google API ResourceExhausted error en endpoint /chat-rag/: {rate_limit_error}")
        # Devolver un error HTTP 429 específico
        raise HTTPException(
            status_code=429, 
            detail=f"Límite de tasa excedido con el proveedor de IA. Por favor, inténtalo más tarde o selecciona otro modelo. (Detalle: {str(rate_limit_error)})"
        )
    except HTTPException as http_exc:
        # Re-lanzar otras excepciones HTTP que ya podrían haber sido levantadas (ej. 404 del vector_store)
        raise http_exc
    except Exception as e:
        print(f"Error general en el endpoint /chat-rag/ para pdf_id {pdf_id_param}: {e}")
        import traceback
        print(traceback.format_exc())
        # Devolver un error 500 genérico para otras excepciones inesperadas
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al chatear con el PDF: {str(e)}")

