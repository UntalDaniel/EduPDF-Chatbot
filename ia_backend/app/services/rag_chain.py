# ia_backend/app/services/rag_chain.py
import logging
import os
from typing import List, Dict, Any, Tuple, Optional

# Vector Database (Pinecone)
from pinecone import Pinecone as PineconeClient
from langchain_community.vectorstores import Pinecone as LangchainPinecone

# Embeddings y LLM (Google Generative AI)
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# Langchain - Chains and Memory
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage # Para historial de chat

# Google API Exceptions
from google.api_core import exceptions as google_exceptions

# Application-specific
from app.core.config import settings # Usar settings para todas las claves
from app.models.schemas import ChatResponse, SourceDocument, MessageInput # Asegúrate que estos modelos estén definidos

logger = logging.getLogger(__name__)

# --- Pinecone Initialization ---
pc: Optional[PineconeClient] = None
pinecone_index_instance: Optional[Any] = None # Para la instancia del índice de Pinecone

if settings.PINECONE_API_KEY and settings.PINECONE_INDEX_NAME:
    try:
        logger.info(f"Initializing Pinecone client for RAG with index: {settings.PINECONE_INDEX_NAME}")
        pc = PineconeClient(api_key=settings.PINECONE_API_KEY)
        
        active_indexes = [idx_spec.name for idx_spec in pc.list_indexes()]
        if settings.PINECONE_INDEX_NAME not in active_indexes:
            logger.warning(f"Pinecone index '{settings.PINECONE_INDEX_NAME}' for RAG not found in active indexes: {active_indexes}. Ensure it's created with 768 dimensions (for Google embeddings) and cosine metric.")
            pinecone_index_instance = None
        else:
            pinecone_index_instance = pc.Index(settings.PINECONE_INDEX_NAME)
            logger.info(f"RAG: Successfully connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize Pinecone: {e}", exc_info=True)
        pc = None
        pinecone_index_instance = None
else:
    logger.warning("RAG: Pinecone API key or index name not configured. Pinecone integration for RAG will be disabled.")


# --- Embeddings Model (Google) ---
embeddings_model_rag: Optional[GoogleGenerativeAIEmbeddings] = None
if settings.GEMINI_API_KEY_BACKEND:
    try:
        embeddings_model_rag = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001", # 768 dimensiones
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            task_type="retrieval_query" # Especificar task_type para embeddings de consulta
        )
        logger.info("RAG: GoogleGenerativeAIEmbeddings model (embedding-001 for query) initialized.")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize GoogleGenerativeAIEmbeddings: {e}. Check GEMINI_API_KEY_BACKEND.", exc_info=True)
else:
    logger.warning("RAG: GEMINI_API_KEY_BACKEND not set. GoogleEmbeddings model for RAG will not be available.")

# --- LLM for Chat (Google Gemini) ---
llm_rag: Optional[ChatGoogleGenerativeAI] = None
if settings.GEMINI_API_KEY_BACKEND:
    try:
        # Usar el modelo especificado en config o un default
        chat_model_id = settings.OPENAI_MODEL_NAME # Aunque se llame OPENAI_MODEL_NAME, aquí usaremos un modelo Gemini
        if not chat_model_id or not chat_model_id.startswith("gemini-"): # Asegurar que sea un modelo Gemini
            chat_model_id = "gemini-1.5-flash-latest" # Fallback a un modelo Gemini conocido
            logger.warning(f"RAG: OPENAI_MODEL_NAME in config ('{settings.OPENAI_MODEL_NAME}') is not a Gemini model. Defaulting to '{chat_model_id}' for RAG LLM.")

        llm_rag = ChatGoogleGenerativeAI(
            model=chat_model_id, # ej: "gemini-1.5-flash-latest", "gemini-pro"
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            temperature=0.3, # Ajustar según necesidad
            convert_system_message_to_human=True,
            request_options={"timeout": 120} # Timeout para la respuesta del LLM
        )
        logger.info(f"RAG: ChatGoogleGenerativeAI LLM initialized with model: {chat_model_id}.")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize ChatGoogleGenerativeAI LLM: {e}. Check GEMINI_API_KEY_BACKEND and model name.", exc_info=True)
else:
    logger.warning("RAG: GEMINI_API_KEY_BACKEND not set. ChatGoogleGenerativeAI LLM for RAG will not be available.")


def get_vector_store_for_pdf_retrieval(pdf_id: str) -> Optional[LangchainPinecone]:
    """
    Gets a LangchainPinecone vector store instance for a given PDF ID (namespace) for retrieval.
    """
    if not pinecone_index_instance:
        logger.error("RAG: Pinecone index is not initialized. Cannot get vector store for retrieval.")
        return None
    if not embeddings_model_rag:
        logger.error("RAG: Embeddings model (Google) is not initialized. Cannot get vector store for retrieval.")
        return None
    
    logger.debug(f"RAG: Accessing vector store for pdf_id (namespace): {pdf_id} using index: {settings.PINECONE_INDEX_NAME}")
    try:
        vector_store = LangchainPinecone(
            index=pinecone_index_instance, 
            embedding=embeddings_model_rag, # Usar el modelo de Google para consulta
            text_key="text", # Coincide con cómo se almacenaron los chunks
            namespace=pdf_id # El pdf_id es el namespace
        )
        logger.info(f"RAG: Successfully initialized LangchainPinecone vector store for retrieval (namespace: {pdf_id})")
        return vector_store
    except Exception as e:
        logger.error(f"RAG: Error initializing LangchainPinecone for retrieval (namespace {pdf_id}): {e}", exc_info=True)
        return None

# --- Conversational RAG Chain ---
# (Los prompts CONDENSE_QUESTION_PROMPT y QA_PROMPT se mantienen como los definiste en tu repo)
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


def get_conversational_rag_chain_google(
    vector_store: LangchainPinecone, # Ahora espera LangchainPinecone
    chat_model_id_from_request: str, # El modelo que el usuario selecciona en el frontend
    chat_history_messages: Optional[List[MessageInput]] = None
) -> ConversationalRetrievalChain:
    """
    Configures and returns a ConversationalRetrievalChain using Google's LLM and Embeddings.
    """
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("RAG: GEMINI_API_KEY_BACKEND no está configurada para el LLM del chat.")
        raise ValueError("GEMINI_API_KEY_BACKEND es necesaria para el LLM del chat.")

    # Usar el modelo de chat que viene en la solicitud, o un default si no es válido
    final_chat_model_id = chat_model_id_from_request
    if not final_chat_model_id or not final_chat_model_id.startswith("gemini-"):
        logger.warning(f"RAG: Modelo de chat solicitado '{chat_model_id_from_request}' no es un modelo Gemini válido. Usando default 'gemini-1.5-flash-latest'.")
        final_chat_model_id = "gemini-1.5-flash-latest"
    
    try:
        current_llm = ChatGoogleGenerativeAI(
            model=final_chat_model_id,
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            temperature=0.3,
            convert_system_message_to_human=True,
            request_options={"timeout": 120}
        )
        logger.info(f"RAG: LLM para la cadena conversacional inicializado con modelo: {final_chat_model_id}")
    except Exception as e:
        logger.error(f"RAG: Error inicializando ChatGoogleGenerativeAI con modelo '{final_chat_model_id}': {e}")
        raise RuntimeError(f"No se pudo inicializar el LLM '{final_chat_model_id}' para RAG: {e}") from e

    memory = ConversationBufferMemory(
        memory_key='chat_history',
        return_messages=True, 
        output_key='answer'  
    )
    
    if chat_history_messages:
        for msg_input in chat_history_messages:
            # Langchain espera HumanMessage y AIMessage
            if msg_input.role == 'user': # o 'human'
                memory.chat_memory.add_message(HumanMessage(content=msg_input.content))
            elif msg_input.role == 'assistant': # o 'ai'
                memory.chat_memory.add_message(AIMessage(content=msg_input.content))
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": settings.RAG_NUM_SOURCE_CHUNKS} 
    )

    chain = ConversationalRetrievalChain.from_llm(
        llm=current_llm,
        retriever=retriever,
        memory=memory, 
        return_source_documents=True,
        condense_question_prompt=CONDENSE_QUESTION_PROMPT,
        combine_docs_chain_kwargs={"prompt": QA_PROMPT},
        # verbose=True # Descomentar para debugging
    )
    return chain

async def query_rag_chain_google( # Renombrada para claridad
    chain: ConversationalRetrievalChain, 
    user_question: str, 
    # El historial para ainvoke debe ser List[Tuple[str, str]] o compatible con la memoria
    # La memoria ya se pobló, así que no necesitamos pasar chat_history_for_invoke aquí si la memoria se usa correctamente.
    # La cadena usará la memoria interna.
    language: str = 'es'
) -> ChatResponse:

    language_instruction_text = f"(Instrucción de idioma para el asistente: Por favor, responde en {'español' if language == 'es' else 'inglés (English)'}.)"
    question_with_lang_instruction = f"{user_question}\n{language_instruction_text}"
    
    logger.info(f"RAG Query: '{user_question}', Language: {language}, Effective question for chain: '{question_with_lang_instruction}'")
        
    try:
        # La memoria ya contiene el historial, ConversationalRetrievalChain lo usa internamente.
        # Solo necesitamos pasar la nueva pregunta.
        result = await chain.acall({"question": question_with_lang_instruction})
        
        answer = result.get("answer", "No se pudo obtener una respuesta del LLM.")
        
        source_documents_data = []
        if result.get("source_documents"):
            for doc in result["source_documents"]:
                source_documents_data.append(
                    SourceDocument(
                        page_content=doc.page_content,
                        metadata=doc.metadata or {} 
                    )
                )
        
        logger.info(f"RAG: Respuesta obtenida: '{answer[:100]}...'")
        if source_documents_data:
            logger.debug(f"RAG: Fuentes encontradas: {len(source_documents_data)}")

        return ChatResponse(answer=answer, sources=source_documents_data if source_documents_data else None)

    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG: Google API ResourceExhausted error: {e}", exc_info=True)
        raise # Re-lanzar para que el endpoint lo maneje como 429
    except Exception as e:
        logger.error(f"RAG: Error general al consultar la cadena RAG: {e}", exc_info=True)
        return ChatResponse(answer=f"Error interno al procesar la pregunta: {str(e)}", sources=None)

# Funciones que ya tenías para Pinecone, adaptadas ligeramente si es necesario
async def delete_pdf_vector_store(pdf_id: str): # Esta función ya debería funcionar si pinecone_index_instance está ok
    if not pinecone_index_instance:
        logger.warning("RAG: Pinecone index not initialized. Cannot delete namespace.")
        return

    try:
        logger.info(f"RAG: Attempting to delete namespace '{pdf_id}' from Pinecone index '{settings.PINECONE_INDEX_NAME}'.")
        pinecone_index_instance.delete(namespace=pdf_id) 
        logger.info(f"RAG: Successfully deleted all vectors in namespace '{pdf_id}'.")
    except Exception as e:
        logger.error(f"RAG: Error deleting namespace '{pdf_id}' from Pinecone: {e}", exc_info=True)
        # No relanzar aquí, solo loguear. El borrado es 'best effort'.

# La función get_rag_response que llama tu main.py ahora debería ser esta:
async def get_rag_response(
    pdf_id: str,
    query_text: str,
    chat_history: Optional[List[Dict[str, str]]] = None, # El formato que viene del frontend
    user_id: Optional[str] = None, # user_id no se usa directamente aquí pero podría ser para logging/auditoría
    language: str = 'es', # Añadido desde tu ChatRequestBody
    model_id: str = "gemini-1.5-flash-latest" # Añadido desde tu ChatRequestBody
) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]]]:
    
    vector_store = get_vector_store_for_pdf_retrieval(pdf_id)
    if not vector_store:
        logger.error(f"RAG: Vector store para pdf_id '{pdf_id}' no encontrado o no inicializado para get_rag_response.")
        return "Lo siento, no pude acceder a la información del PDF. Asegúrate de que haya sido procesado correctamente.", None

    # Convertir el historial del frontend al formato MessageInput para la memoria
    chat_history_messages_input: List[MessageInput] = []
    if chat_history:
        for msg_dict in chat_history:
            role_for_memory: Literal["user", "assistant"] = "user" # Default
            if msg_dict.get("role") in ["user", "human"]:
                role_for_memory = "user"
            elif msg_dict.get("role") in ["assistant", "ai", "bot"]:
                role_for_memory = "assistant"
            chat_history_messages_input.append(MessageInput(role=role_for_memory, content=msg_dict["content"]))
    
    chain = get_conversational_rag_chain_google(
        vector_store=vector_store,
        chat_model_id_from_request=model_id, # Pasar el model_id de la solicitud
        chat_history_messages=chat_history_messages_input
    )
    
    try:
        chat_response_obj = await query_rag_chain_google(
            chain=chain,
            user_question=query_text,
            language=language
        )
        
        source_chunks_for_main_response: Optional[List[Dict[str, Any]]] = None
        if chat_response_obj.sources:
            source_chunks_for_main_response = [
                {"page_content": s.page_content, "metadata": s.metadata} for s in chat_response_obj.sources
            ]
            
        return chat_response_obj.answer, source_chunks_for_main_response
        
    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG get_rag_response: Google API ResourceExhausted: {e}", exc_info=True)
        # El endpoint en main.py ya maneja la conversión a HTTPException 429
        raise # Re-lanzar para que el endpoint lo maneje

    except Exception as e:
        logger.error(f"RAG get_rag_response: Error general: {e}", exc_info=True)
        return f"Error interno al obtener respuesta del RAG: {str(e)}", None

