# ia_backend/app/services/rag_chain.py
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain_community.vectorstores import FAISS
from langchain.prompts import PromptTemplate
# Asegúrate de que HumanMessage y AIMessage estén importados si los usas directamente
# from langchain.schema import HumanMessage, AIMessage 
from typing import Optional, List, Tuple # Asegúrate que Tuple esté aquí

# Importar la excepción específica de Google
from google.api_core import exceptions as google_exceptions


from app.core.config import GEMINI_API_KEY
from app.models.schemas import ChatResponse, SourceDocument, MessageInput

# --- Prompt Template para reformular la pregunta (condensar historial) ---
# Objetivo: Crear una pregunta independiente y contextualizada basada en el historial y la pregunta de seguimiento.
condense_question_template_text = """Dada la siguiente conversación y una pregunta de seguimiento, tu tarea es reformular la pregunta de seguimiento para que sea una pregunta independiente y concisa.
Esta pregunta independiente debe estar en el MISMO IDIOMA que la "Pregunta de Seguimiento" original.

Consideraciones importantes para la reformulación:
1.  **Autocontenida:** La pregunta reformulada debe entenderse por sí sola, sin necesidad de leer el historial previo.
2.  **Contexto Específico:** Si la "Pregunta de Seguimiento" es una aclaración, una solicitud de más detalles sobre un punto anterior, o se refiere a entidades/conceptos mencionados en el "Historial del Chat", la pregunta reformulada DEBE incorporar explícitamente ese contexto. Por ejemplo, si la IA acaba de explicar el "proceso A" y el usuario pregunta "¿Puedes detallar el segundo paso?", la pregunta reformulada podría ser: "Por favor, detalla el segundo paso del proceso A que mencionaste anteriormente."
3.  **Tema Central:** Mantén el tema y la intención principal de la "Pregunta de Seguimiento".
4.  **Instrucciones Generales:** Si la "Pregunta de Seguimiento" es una instrucción general (ej. "haz un resumen", "explícame más sobre eso", "¿qué más puedes decir?") y el "Historial del Chat" está vacío o no es directamente relevante para refinar la instrucción (ej. el historial es sobre un tema completamente diferente), mantén la instrucción de seguimiento tal cual, pero asegúrate de que esté en el idioma correcto. Si el historial SÍ es relevante (ej. "explícame más sobre *eso*" donde *eso* se refiere a la última respuesta del bot), entonces incorpora el tema de "eso" en la pregunta.
5.  **Concisión:** Sé lo más conciso posible sin perder el contexto necesario.

Historial del Chat:
{chat_history}

Pregunta de Seguimiento: {question}

Pregunta Independiente Concisa y Contextualizada (en el mismo idioma que la Pregunta de Seguimiento):"""
CONDENSE_QUESTION_PROMPT = PromptTemplate.from_template(condense_question_template_text)

# --- Prompt para la combinación de documentos (QA) ---
# Objetivo: Generar una respuesta útil y precisa basada estrictamente en el contexto del documento.
qa_template_text = """Eres EduPDF Bot, un asistente de IA especializado en analizar el contenido de documentos PDF para responder preguntas. Tu conocimiento se limita ESTRICTAMENTE a la información contenida en los fragmentos del documento que se te proporcionan.

Contexto del documento (fragmentos extraídos):
{context}

Pregunta del usuario (esta pregunta ya ha sido procesada para ser independiente y puede incluir una instrucción de idioma):
{question}

Instrucciones para tu respuesta:
1.  **Base Estricta en el Contexto:** Tu respuesta DEBE basarse única y exclusivamente en la información presente en el "Contexto del documento" proporcionado arriba. No utilices conocimiento externo ni hagas suposiciones más allá de lo explícitamente indicado en los fragmentos.
2.  **Respuesta Directa:** Si el "Contexto del documento" contiene información directamente relevante y suficiente para responder completamente la "Pregunta del usuario", elabora una respuesta clara, completa y precisa.
3.  **Información Parcial:** Si el contexto contiene información parcial pero útil para la pregunta, proporciona esa información, indicando si es necesario que la respuesta podría ser más completa con más contexto del documento original.
4.  **Solicitudes de Resumen:** Si la pregunta es una solicitud de resumen:
    * Si el "Contexto del documento" contiene fragmentos relevantes, sintetiza los puntos principales que se puedan extraer de esos fragmentos para formar un resumen coherente.
    * Si los fragmentos parecen insuficientes para un resumen completo del tema general del documento, indícalo, mencionando los temas o aspectos que sí se pueden identificar a partir del contexto dado.
5.  **Información No Encontrada:** Si, después de un análisis cuidadoso, la información necesaria para responder la pregunta específica NO se encuentra en el "Contexto del documento", responde de manera amable y clara: "Basándome en los fragmentos del documento que tengo disponibles, no he podido encontrar la información específica para responder a tu pregunta sobre [tema de la pregunta, si es identificable]." No inventes una respuesta.
6.  **Idioma:** La "Pregunta del usuario" puede contener una instrucción explícita sobre el idioma de la respuesta (ej. "(Instrucción de idioma para el asistente: Por favor, responde en español.)"). DEBES seguir esta instrucción de idioma para tu respuesta. Si no hay instrucción explícita, responde en el idioma predominante de la pregunta.
7.  **Tono:** Mantén un tono útil, objetivo y educativo.

Respuesta útil y precisa (siguiendo estrictamente las instrucciones y el contexto proporcionado):"""
QA_PROMPT = PromptTemplate(
    template=qa_template_text,
    input_variables=["context", "question"]
)

def get_conversational_rag_chain(vector_store: FAISS, model_id: str = "gemini-1.5-flash-latest", chat_history_messages: Optional[List[MessageInput]] = None):
    if not GEMINI_API_KEY:
        print("ERROR CRÍTICO: GEMINI_API_KEY_BACKEND no está configurada.")
        raise ValueError("GEMINI_API_KEY_BACKEND no está configurada en el entorno para el LLM.")

    try:
        print(f"Inicializando LLM con el modelo: {model_id}")
        llm = ChatGoogleGenerativeAI(
            model=model_id,
            google_api_key=GEMINI_API_KEY,
            temperature=0.3, # Un valor bajo para respuestas más basadas en hechos y menos creativas
            convert_system_message_to_human=True, 
            request_options={"timeout": 120} 
        )
    except Exception as e:
        print(f"Error inicializando ChatGoogleGenerativeAI con el modelo '{model_id}': {e}")
        raise RuntimeError(f"No se pudo inicializar el LLM '{model_id}': {e}") from e

    memory = ConversationBufferMemory(
        memory_key='chat_history',
        return_messages=True, 
        output_key='answer'  
    )
    
    if chat_history_messages:
        for msg_input in chat_history_messages:
            if msg_input.role == 'user':
                memory.chat_memory.add_user_message(msg_input.content)
            elif msg_input.role == 'assistant':
                memory.chat_memory.add_ai_message(msg_input.content)
    
    loaded_memory_vars = memory.load_memory_variables({})
    if loaded_memory_vars.get('chat_history'): 
        print(f"Memoria después de cargar historial: {loaded_memory_vars}")
    else:
        print("Memoria inicializada sin historial previo (o historial vacío).")

    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 5} # Recuperar los 5 chunks más relevantes
    )

    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=retriever,
        memory=memory, 
        return_source_documents=True,
        condense_question_prompt=CONDENSE_QUESTION_PROMPT,
        combine_docs_chain_kwargs={"prompt": QA_PROMPT},
        # verbose=True # Descomentar para debugging detallado
    )
    return chain

async def query_rag_chain(
    chain: ConversationalRetrievalChain, 
    user_question: str, 
    chat_history_for_invoke: List[Tuple[str, str]], 
    language: str = 'es'
) -> ChatResponse:

    # La instrucción de idioma se añade explícitamente a la pregunta que verá el QA_PROMPT.
    # El CONDENSE_QUESTION_PROMPT trabajará sobre la user_question original para mantener su idioma.
    language_instruction_text = f"(Instrucción de idioma para el asistente: Por favor, responde en {'español' if language == 'es' else 'inglés (English)'}.)"
    
    # La pregunta que se pasa a `chain.ainvoke` es la que primero ve el `condense_question_prompt`.
    # Luego, la pregunta condensada (que debería mantener el idioma original de user_question)
    # se combina con la instrucción de idioma antes de pasarse al `combine_docs_chain` (que usa QA_PROMPT).
    
    # Para asegurar que la instrucción de idioma llegue al QA_PROMPT a través de la pregunta condensada,
    # la ConversationalRetrievalChain pasa la salida del condense_question_prompt como la 'question'
    # al combine_docs_chain. Añadiremos la instrucción de idioma a la user_question ANTES de que
    # sea procesada por el condense_question_prompt para que la pregunta condensada ya la incluya.
    # Esto asegura que el QA_PROMPT siempre reciba la instrucción de idioma.
    
    question_with_lang_instruction_for_condenser_and_qa = f"{user_question}\n{language_instruction_text}"
    
    print(f"Pregunta original del usuario: {user_question}")
    print(f"Pregunta enviada a chain.ainvoke (con instrucción de idioma para QA): {question_with_lang_instruction_for_condenser_and_qa}")
    print(f"Historial para .ainvoke (formato tuplas para condense_question_prompt): {chat_history_for_invoke}")
    print(f"Idioma Solicitado para QA_PROMPT (a través de la pregunta): {language}")
        
    try:
        result = await chain.ainvoke({
            "question": question_with_lang_instruction_for_condenser_and_qa, 
            "chat_history": chat_history_for_invoke 
        })
        
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
        
        print(f"Respuesta de la cadena RAG: {answer}")
        if source_documents_data:
            print(f"Fuentes encontradas: {len(source_documents_data)}")
        else:
            print("No se recuperaron documentos fuente relevantes para esta pregunta.")

        return ChatResponse(answer=answer, sources=source_documents_data if source_documents_data else None)

    except google_exceptions.ResourceExhausted as e:
        print(f"Google API ResourceExhausted error en query_rag_chain: {e}")
        raise 
    except Exception as e:
        print(f"Error general al consultar la cadena RAG: {e}")
        import traceback
        print(traceback.format_exc()) 
        return ChatResponse(answer=f"Error interno al procesar la pregunta: {str(e)}", sources=None)

