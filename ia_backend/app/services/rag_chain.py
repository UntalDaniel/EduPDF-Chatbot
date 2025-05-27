# ia_backend/app/services/rag_chain.py
import logging
import os
from typing import List, Dict, Any, Tuple, Optional, Literal, Union # Asegúrate que Literal y Union estén importados

# Vector Database (Pinecone)
from pinecone import Pinecone as PineconeClient 
from langchain_community.vectorstores import Pinecone as LangchainPinecone

# Embeddings y LLM (Google Generative AI)
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# Langchain - Chains and Memory
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage 

# Google API Exceptions
from google.api_core import exceptions as google_exceptions 

# Application-specific
from app.core.config import settings 
from app.models.schemas import ChatResponse, SourceDocument, MessageInput 

logger = logging.getLogger(__name__)

# --- Pinecone Initialization ---
pc_client: Optional[PineconeClient] = None 
pinecone_index_instance: Optional[Any] = None 

if settings.PINECONE_API_KEY and settings.PINECONE_ENVIRONMENT and settings.PINECONE_INDEX_NAME: 
    try:
        logger.info(f"Initializing Pinecone client for RAG with index: {settings.PINECONE_INDEX_NAME} in env: {settings.PINECONE_ENVIRONMENT}")
        pc_client = PineconeClient(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENVIRONMENT) 
        
        active_indexes = [idx_spec["name"] for idx_spec in pc_client.list_indexes()] 
        if settings.PINECONE_INDEX_NAME not in active_indexes:
            logger.warning(f"Pinecone index '{settings.PINECONE_INDEX_NAME}' for RAG not found in active indexes: {active_indexes}. Ensure it's created with 768 dimensions (for Google embeddings) and cosine metric.")
            pinecone_index_instance = None
        else:
            pinecone_index_instance = pc_client.Index(settings.PINECONE_INDEX_NAME)
            logger.info(f"RAG: Successfully connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize Pinecone: {e}", exc_info=True)
        pc_client = None
        pinecone_index_instance = None
else:
    logger.warning("RAG: Pinecone API key, environment, or index name not configured. Pinecone integration for RAG will be disabled.")


# --- Embeddings Model (Google) ---
embeddings_model_rag: Optional[GoogleGenerativeAIEmbeddings] = None
if settings.GEMINI_API_KEY_BACKEND:
    try:
        # Asegúrate que EMBEDDING_MODEL_NAME esté definido en tus settings
        embedding_model_name_to_use = getattr(settings, "EMBEDDING_MODEL_NAME", "models/embedding-001")
        embeddings_model_rag = GoogleGenerativeAIEmbeddings(
            model=embedding_model_name_to_use, 
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
            task_type="retrieval_query" 
        )
        logger.info(f"RAG: GoogleGenerativeAIEmbeddings model ({embedding_model_name_to_use} for query) initialized.")
    except Exception as e:
        logger.error(f"RAG: Failed to initialize GoogleGenerativeAIEmbeddings: {e}. Check GEMINI_API_KEY_BACKEND.", exc_info=True)
else:
    logger.warning("RAG: GEMINI_API_KEY_BACKEND not set. GoogleEmbeddings model for RAG will not be available.")

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


def get_vector_store_for_pdf_retrieval(pdf_id: str) -> Optional[LangchainPinecone]:
    if not pinecone_index_instance: 
        logger.error("RAG: Pinecone index (pinecone_index_instance) is not initialized. Cannot get vector store.")
        return None
    if not embeddings_model_rag: 
        logger.error("RAG: Embeddings model (embeddings_model_rag) is not initialized. Cannot get vector store.")
        return None
    
    logger.debug(f"RAG: Accessing vector store for pdf_id (namespace): {pdf_id} using index: {settings.PINECONE_INDEX_NAME}")
    try:
        vector_store = LangchainPinecone(
            index=pinecone_index_instance, 
            embedding=embeddings_model_rag, 
            text_key="text", 
            namespace=pdf_id 
        )
        logger.info(f"RAG: Successfully initialized LangchainPinecone vector store for retrieval (namespace: {pdf_id})")
        return vector_store
    except Exception as e:
        logger.error(f"RAG: Error initializing LangchainPinecone for retrieval (namespace {pdf_id}): {e}", exc_info=True)
        return None


def get_conversational_rag_chain_google(
    vector_store: LangchainPinecone, 
    chat_model_id_from_request: str, 
) -> ConversationalRetrievalChain:
    if not settings.GEMINI_API_KEY_BACKEND:
        logger.error("RAG: GEMINI_API_KEY_BACKEND no está configurada para el LLM del chat.")
        raise ValueError("GEMINI_API_KEY_BACKEND es necesaria para el LLM del chat.")

    final_chat_model_id = chat_model_id_from_request
    default_model = getattr(settings, "DEFAULT_GEMINI_MODEL_RAG", "gemini-1.5-flash-latest")
    rag_llm_temp = getattr(settings, "RAG_LLM_TEMPERATURE", 0.3)
    rag_llm_timeout = getattr(settings, "RAG_LLM_TIMEOUT_SECONDS", 120)
    rag_num_chunks = getattr(settings, "RAG_NUM_SOURCE_CHUNKS", 5)
    rag_verbose_setting = getattr(settings, "RAG_VERBOSE", False)

    if not final_chat_model_id or not final_chat_model_id.startswith("gemini-"):
        logger.warning(f"RAG: Modelo de chat solicitado '{chat_model_id_from_request}' no es un modelo Gemini válido. Usando default '{default_model}'.")
        final_chat_model_id = default_model
    
    try:
        current_llm = ChatGoogleGenerativeAI(
            model=final_chat_model_id,
            google_api_key=settings.GEMINI_API_KEY_BACKEND,
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
    chat_history_for_chain: List[Union[Tuple[str, str], HumanMessage, AIMessage]], 
    language: str = 'es' 
) -> ChatResponse:
    
    logger.info(f"RAG Query: '{user_question}', Language: {language}")
        
    try:
        result = await chain.acall({"question": user_question, "chat_history": chat_history_for_chain})
        
        answer = result.get("answer", "No se pudo obtener una respuesta del LLM.")
        
        source_documents_data: List[SourceDocument] = [] 
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

        return ChatResponse(answer=answer, sources=source_documents_data)

    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG: Google API ResourceExhausted error: {e.message if hasattr(e, 'message') else str(e)}", exc_info=True) # type: ignore
        raise 
    except Exception as e:
        logger.error(f"RAG: Error general al consultar la cadena RAG: {e}", exc_info=True)
        return ChatResponse(answer=f"Error interno al procesar la pregunta.", sources=[], error=str(e))


async def delete_pdf_vector_store_namespace(pdf_id: str) -> bool: 
    if not pinecone_index_instance:
        logger.warning("RAG: Pinecone index not initialized. Cannot delete namespace.")
        return False 

    try:
        logger.info(f"RAG: Attempting to delete namespace '{pdf_id}' from Pinecone index '{settings.PINECONE_INDEX_NAME}'.")
        pinecone_index_instance.delete(namespace=pdf_id) 
        logger.info(f"RAG: Successfully submitted delete request for all vectors in namespace '{pdf_id}'.")
        return True 
    except Exception as e:
        logger.error(f"RAG: Error deleting namespace '{pdf_id}' from Pinecone: {e}", exc_info=True)
        return False 


async def get_rag_response(
    pdf_id: str,
    query_text: str,
    chat_history_from_frontend: Optional[List[Dict[str, str]]] = None, 
    user_id: Optional[str] = None, 
    language: str = 'es', 
    model_id: str = "gemini-1.5-flash-latest" 
) -> ChatResponse: 
    
    vector_store = get_vector_store_for_pdf_retrieval(pdf_id)
    if not vector_store:
        logger.error(f"RAG: Vector store para pdf_id '{pdf_id}' no encontrado o no inicializado.")
        return ChatResponse(answer="Lo siento, no pude acceder a la información del PDF. Asegúrate de que haya sido procesado correctamente.", sources=[], error="Vector store not found")

    langchain_chat_history: List[Union[HumanMessage, AIMessage]] = [] 
    if chat_history_from_frontend:
        for msg_dict in chat_history_from_frontend:
            role = msg_dict.get("role")
            content = msg_dict.get("content", "")
            # Aquí es donde Pylance podría haber tenido problemas si Literal no estaba importado
            # y si los roles en MessageInput no estaban definidos con Literal.
            # Ahora, con Literal importado y usado en MessageInput, esto debería ser más robusto.
            # Los valores "user", "assistant" son strings.
            if role in ["user", "human"]: # Comparación con strings
                langchain_chat_history.append(HumanMessage(content=content))
            elif role in ["assistant", "ai", "bot"]: # Comparación con strings
                langchain_chat_history.append(AIMessage(content=content))
    
    chain = get_conversational_rag_chain_google(
        vector_store=vector_store,
        chat_model_id_from_request=model_id,
    )
    
    try:
        chat_response_obj = await query_rag_chain_google(
            chain=chain,
            user_question=query_text,
            chat_history_for_chain=langchain_chat_history, 
            language=language
        )
        return chat_response_obj
        
    except google_exceptions.ResourceExhausted as e:
        logger.error(f"RAG get_rag_response: Google API ResourceExhausted: {e.message if hasattr(e, 'message') else str(e)}", exc_info=True) # type: ignore
        raise 
    except Exception as e:
        logger.error(f"RAG get_rag_response: Error general: {e}", exc_info=True)
        return ChatResponse(answer=f"Error interno al obtener respuesta del RAG.", sources=[], error=str(e))
