# ia_backend/app/services/rag_chain.py
import logging
from typing import List, Dict, Any, Tuple, Optional, Union

# Importación clave para la nueva integración de Pinecone con Langchain v0.1.0+ y pinecone-client v3/v4+
from langchain_pinecone import PineconeVectorStore

# Para la gestión directa del índice Pinecone
from pinecone import Pinecone as PineconeSdkClient

from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from google.api_core import exceptions as google_exceptions

from app.core.config import settings
from app.models.schemas import ChatResponse, SourceDocument

logger = logging.getLogger(__name__)

# --- Pinecone SDK Client (para operaciones de gestión como delete_namespace) ---
pinecone_sdk_client_rag: Optional[PineconeSdkClient] = None
if settings.PINECONE_API_KEY:
    try:
        # PINECONE_ENVIRONMENT no es necesario para inicializar PineconeSdkClient v3+
        # a menos que estés usando funcionalidades específicas que lo requieran explícitamente.
        # La conexión al índice específico (que puede estar en un environment) se hace con .Index()
        pinecone_sdk_client_rag = PineconeSdkClient(api_key=settings.PINECONE_API_KEY)
        logger.info(f"RAG: Pinecone SDK client initialized for management tasks.")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize Pinecone SDK client: {e}", exc_info=True)
        pinecone_sdk_client_rag = None
else:
    logger.warning("RAG: PINECONE_API_KEY not configured. Direct Pinecone SDK client for RAG will not be available.")


# --- Inicialización del Modelo de Embeddings (Google) para RAG ---
embeddings_model_rag_instance: Optional[GoogleGenerativeAIEmbeddings] = None
try:
    # Usar GEMINI_API_KEY_BACKEND y EMBEDDING_MODEL_NAME (singular)
    gemini_api_key_valid = hasattr(settings, 'GEMINI_API_KEY_BACKEND') and settings.GEMINI_API_KEY_BACKEND
    embedding_model_name_valid = hasattr(settings, 'EMBEDDING_MODEL_NAME') and settings.EMBEDDING_MODEL_NAME

    if gemini_api_key_valid and embedding_model_name_valid:
        embeddings_model_rag_instance = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL_NAME, # Singular
            google_api_key=settings.GEMINI_API_KEY_BACKEND, # Usar la clave correcta
            task_type="retrieval_query"
        )
        logger.info(f"RAG: GoogleGenerativeAIEmbeddings model ({settings.EMBEDDING_MODEL_NAME} for query) initialized.")
    else:
        missing_keys = []
        if not gemini_api_key_valid:
            missing_keys.append("GEMINI_API_KEY_BACKEND (para embeddings en RAG)")
        if not embedding_model_name_valid:
            missing_keys.append("EMBEDDING_MODEL_NAME (singular)")
        logger.error(f"RAG: Cannot initialize GoogleGenerativeAIEmbeddings. Missing or empty required settings: {', '.join(missing_keys)}. Please check your .env file and app/core/config.py.")
        embeddings_model_rag_instance = None

except AttributeError as ae:
    logger.error(f"RAG: AttributeError initializing GoogleGenerativeAIEmbeddings: {ae}. This likely means GEMINI_API_KEY_BACKEND or EMBEDDING_MODEL_NAME is missing or misspelled in your Settings class (app/core/config.py) or .env file.", exc_info=True)
    embeddings_model_rag_instance = None
except Exception as e:
    logger.error(f"RAG: Failed to initialize GoogleGenerativeAIEmbeddings: {e}. Check GEMINI_API_KEY_BACKEND and EMBEDDING_MODEL_NAME in your configuration.", exc_info=True)
    embeddings_model_rag_instance = None


# --- Conversational RAG Chain Prompts ---
condense_question_template_text = """Dada la siguiente conversación y una pregunta de seguimiento, tu tarea es reformular la pregunta de seguimiento para que sea una pregunta independiente y concisa.
Esta pregunta independiente debe estar en el MISMO IDIOMA que la "Pregunta de Seguimiento" original.
Consideraciones importantes para la reformulación:
1.  **Autocontenida:** La pregunta reformulada debe entenderse por sí sola, sin necesidad de leer el historial previo.
2.  **Contexto Específico:** Si la "Pregunta de Seguimiento" es una aclaración, una solicitud de más detalles sobre un punto anterior, o se refiere a entidades/conceptos mencionados en el "Historial del Chat", la pregunta reformulada DEBE incorporar explícitamente ese contexto.
3.  **Tema Central:** Mantén el tema y la intención principal de la "Pregunta de Seguimiento".
4.  **Instrucciones Generales:** Si la "Pregunta de Seguimiento" es una instrucción general y el "Historial del Chat" está vacío o no es directamente relevante, mantén la instrucción tal cual, pero en el idioma correcto. Si el historial SÍ es relevante, incorpora el tema.
5.  **Concisión:** Sé lo más conciso posible sin perder el contexto necesario.

Historial del Chat:
{chat_history}

Pregunta de Seguimiento: {question}
Pregunta Independiente Concisa y Contextualizada (en el mismo idioma que la Pregunta de Seguimiento):"""
CONDENSE_QUESTION_PROMPT = PromptTemplate.from_template(condense_question_template_text)

qa_template_text = """Eres EduPDF Bot, un asistente de IA especializado en analizar el contenido de documentos PDF para responder preguntas. Tu conocimiento se limita ESTRICTAMENTE a la información contenida en los fragmentos del documento que se te proporcionan.
Contexto del documento (fragmentos extraídos):
{context}
Pregunta del usuario (esta pregunta ya ha sido procesada para ser independiente y puede incluir una instrucción de idioma):
{question}
Instrucciones para tu respuesta:
1.  **Base Estricta en el Contexto:** Tu respuesta DEBE basarse única y exclusivamente en la información presente en el "Contexto del documento". No uses conocimiento externo.
2.  **Respuesta Directa:** Si el contexto es suficiente, elabora una respuesta clara y precisa.
3.  **Información Parcial:** Si es parcial, indícalo.
4.  **Solicitudes de Resumen:** Resume los puntos principales de los fragmentos. Si son insuficientes para un resumen general, indícalo.
5.  **Información No Encontrada:** Si la información NO está, responde amablemente: "Basándome en los fragmentos del documento que tengo disponibles, no he podido encontrar la información específica para responder a tu pregunta sobre [tema]." No inventes.
6.  **Idioma:** Sigue la instrucción de idioma en la "Pregunta del usuario". Si no hay, responde en el idioma de la pregunta.
7.  **Tono:** Útil, objetivo y educativo.
Respuesta útil y precisa (siguiendo estrictamente las instrucciones y el contexto proporcionado):"""
QA_PROMPT = PromptTemplate(template=qa_template_text, input_variables=["context", "question"])


def get_vector_store_for_pdf_retrieval(pdf_id: str) -> Optional[PineconeVectorStore]:
    if not embeddings_model_rag_instance:
        logger.error("RAG: Embeddings model (embeddings_model_rag_instance) is not initialized. Cannot get vector store.")
        return None
    if not settings.PINECONE_API_KEY or not settings.PINECONE_INDEX_NAME:
        logger.error("RAG: Pinecone API key or Index Name not configured. Cannot get vector store.")
        return None

    logger.debug(f"RAG: Accessing PineconeVectorStore for index: '{settings.PINECONE_INDEX_NAME}', namespace: '{pdf_id}'")
    try:
        vector_store = PineconeVectorStore.from_existing_index(
            index_name=settings.PINECONE_INDEX_NAME,
            embedding=embeddings_model_rag_instance,
            namespace=pdf_id,
        )
        logger.info(f"RAG: Successfully initialized PineconeVectorStore for retrieval (namespace: {pdf_id})")
        return vector_store
    except Exception as e:
        logger.error(f"RAG: Error initializing PineconeVectorStore for retrieval (namespace {pdf_id}): {e}", exc_info=True)
        return None


def get_conversational_rag_chain_google(
    vector_store: PineconeVectorStore,
    chat_model_id_from_request: str,
) -> ConversationalRetrievalChain:
    if not (hasattr(settings, 'GEMINI_API_KEY_BACKEND') and settings.GEMINI_API_KEY_BACKEND):
        logger.error("RAG: GEMINI_API_KEY_BACKEND no está configurada para el LLM del chat.")
        raise ValueError("GEMINI_API_KEY_BACKEND es necesaria para el LLM del chat.")

    final_chat_model_id = chat_model_id_from_request
    default_model = settings.DEFAULT_GEMINI_MODEL_RAG
    rag_llm_temp = settings.RAG_LLM_TEMPERATURE
    rag_llm_timeout = settings.RAG_LLM_TIMEOUT_SECONDS
    rag_num_chunks = settings.RAG_NUM_SOURCE_CHUNKS
    rag_verbose_setting = settings.RAG_VERBOSE

    if not final_chat_model_id or not final_chat_model_id.startswith("gemini-"):
        logger.warning(f"RAG: Modelo de chat solicitado '{chat_model_id_from_request}' no es un modelo Gemini válido. Usando default '{default_model}'.")
        final_chat_model_id = default_model
    
    try:
        current_llm = ChatGoogleGenerativeAI(
            model=final_chat_model_id,
            google_api_key=settings.GEMINI_API_KEY_BACKEND, # Usar la clave correcta
            temperature=rag_llm_temp,
            convert_system_message_to_human=True,
            request_options={"timeout": rag_llm_timeout}
        )
        logger.info(f"RAG: LLM para cadena conversacional inicializado con modelo: {final_chat_model_id}")
    except Exception as e:
        logger.error(f"RAG: Error inicializando ChatGoogleGenerativeAI con modelo '{final_chat_model_id}': {e}")
        raise RuntimeError(f"No se pudo inicializar el LLM '{final_chat_model_id}' para RAG: {e}") from e

    memory = ConversationBufferMemory(
        memory_key='chat_history',
        return_messages=True,
        output_key='answer'
    )
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": rag_num_chunks}
    )

    chain = ConversationalRetrievalChain.from_llm(
        llm=current_llm,
        retriever=retriever,
        memory=memory,
        return_source_documents=True,
        condense_question_prompt=CONDENSE_QUESTION_PROMPT,
        combine_docs_chain_kwargs={"prompt": QA_PROMPT},
        verbose=rag_verbose_setting
    )
    return chain

async def query_rag_chain_google(
    chain: ConversationalRetrievalChain,
    user_question: str,
    language: str = 'es'
) -> ChatResponse:
    
    logger.info(f"RAG Query: '{user_question}', Language: {language}")
    try:
        result = await chain.acall({"question": user_question})
        
        answer = result.get("answer", "No se pudo obtener una respuesta del LLM.")
        
        source_documents_data: List[SourceDocument] = []
        if result.get("source_documents"):
            for doc_langchain in result["source_documents"]:
                source_documents_data.append(
                    SourceDocument(
                        page_content=doc_langchain.page_content,
                        metadata=doc_langchain.metadata or {}
                    )
                )
        
        logger.info(f"RAG: Respuesta obtenida: '{answer[:100]}...'")
        if source_documents_data:
            logger.debug(f"RAG: Fuentes encontradas: {len(source_documents_data)}")

        return ChatResponse(answer=answer, sources=source_documents_data)

    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG: Google API ResourceExhausted error: {e.message if hasattr(e, 'message') else str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"RAG: Error general al consultar la cadena RAG: {e}", exc_info=True)
        return ChatResponse(answer=f"Error interno al procesar la pregunta.", sources=[], error=str(e))


async def get_rag_response(
    pdf_id: str,
    query_text: str,
    chat_history_from_frontend: Optional[List[Dict[str, str]]] = None,
    user_id: Optional[str] = None,
    language: str = 'es',
    model_id: str = "gemini-1.5-flash-latest"
) -> ChatResponse:
    
    if not embeddings_model_rag_instance: # Comprobar si el modelo de embeddings está disponible
        logger.error(f"RAG: Embeddings model not initialized for pdf_id '{pdf_id}'. Cannot proceed.")
        return ChatResponse(answer="El servicio de IA no está configurado correctamente (modelo de embeddings no disponible).", sources=[], error="Embeddings model not initialized")

    vector_store = get_vector_store_for_pdf_retrieval(pdf_id)
    if not vector_store:
        logger.error(f"RAG: Vector store para pdf_id '{pdf_id}' no encontrado o no inicializado.")
        return ChatResponse(answer="Lo siento, no pude acceder a la información del PDF. Asegúrate de que haya sido procesado correctamente.", sources=[], error="Vector store not found")

    chain = get_conversational_rag_chain_google(
        vector_store=vector_store,
        chat_model_id_from_request=model_id,
    )

    if chat_history_from_frontend:
        for msg_dict in chat_history_from_frontend:
            role = msg_dict.get("role")
            content = msg_dict.get("content", "")
            if role in ["user", "human"]:
                chain.memory.chat_memory.add_user_message(content)
            elif role in ["assistant", "ai", "bot"]:
                chain.memory.chat_memory.add_ai_message(content)
        logger.debug(f"RAG: Historial de chat cargado en la memoria de la cadena ({len(chat_history_from_frontend)} mensajes).")
    
    try:
        chat_response_obj = await query_rag_chain_google(
            chain=chain,
            user_question=query_text,
            language=language
        )
        return chat_response_obj
        
    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG get_rag_response: Google API ResourceExhausted: {e.message if hasattr(e, 'message') else str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"RAG get_rag_response: Error general: {e}", exc_info=True)
        return ChatResponse(answer=f"Error interno al obtener respuesta del RAG.", sources=[], error=str(e))

# FUNCIÓN REINCORPORADA (SÍNCRONA)
def delete_pdf_vector_store_namespace(pdf_id: str) -> bool:
    """
    Deletes all vectors in a specific namespace from the Pinecone index.
    This function is synchronous.
    """
    if not pinecone_sdk_client_rag:
        logger.warning("RAG: Pinecone SDK client (pinecone_sdk_client_rag) not initialized. Cannot delete namespace.")
        return False
    if not settings.PINECONE_INDEX_NAME:
        logger.warning("RAG: PINECONE_INDEX_NAME not configured. Cannot delete namespace.")
        return False

    try:
        # Obtener la instancia del índice usando el pinecone_sdk_client_rag
        index_instance_for_delete = pinecone_sdk_client_rag.Index(settings.PINECONE_INDEX_NAME)
        
        logger.info(f"RAG: Attempting to delete namespace '{pdf_id}' from Pinecone index '{settings.PINECONE_INDEX_NAME}'.")
        index_instance_for_delete.delete(namespace=pdf_id) # Llamada síncrona
        logger.info(f"RAG: Successfully submitted delete request for all vectors in namespace '{pdf_id}'.")
        return True
    except Exception as e:
        logger.error(f"RAG: Error deleting namespace '{pdf_id}' from Pinecone: {e}", exc_info=True)
        return False
