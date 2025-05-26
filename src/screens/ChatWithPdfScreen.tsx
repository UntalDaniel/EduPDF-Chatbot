// src/screens/ChatWithPdfScreen.tsx
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, User, Bot, Loader2, FileText, AlertTriangle,
  Mic, Volume2, VolumeX, Play, Pause, X as IconX, BookText, Languages, Settings, Info
} from 'lucide-react';

import { getPdfById } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';

interface SourceDocumentFE {
  page_content: string;
  metadata: Record<string, any>;
}

interface ChatResponseFE {
  answer: string;
  sources?: SourceDocumentFE[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: SourceDocumentFE[];
}

interface BackendMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}
declare let window: SpeechRecognitionWindow;

const FASTAPI_BACKEND_URL = process.env.NODE_ENV === 'development'
                            ? "http://localhost:8000"
                            : "URL_DE_TU_BACKEND_FASTAPI_DESPLEGADO"; // Reemplaza esto en producción

interface ChatModelInfo {
  id: string;
  displayName: string;
  rpm: number;
  dailyRequests: number;
  pricingNote?: string;
  isAlias?: boolean;
}

// **LISTA DE MODELOS ACTUALIZADA SEGÚN LA SELECCIÓN DEL USUARIO**
const AVAILABLE_CHAT_MODELS_INFO: ChatModelInfo[] = [
  { id: "gemini-2.0-flash-lite", displayName: "Gemini 2.0 Flash-Lite", rpm: 30, dailyRequests: 1500 },
  { id: "gemini-1.5-flash-latest", displayName: "Gemini 1.5 Flash", rpm: 15, dailyRequests: 1500, isAlias: true },
  { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", rpm: 15, dailyRequests: 1500, isAlias: true },
  { id: "gemini-1.5-pro-latest", displayName: "Gemini 1.5 Pro", rpm: 2, dailyRequests: 50, isAlias: true },
  { id: "gemma-3-27b-it", displayName: "Gemma 3 27B", rpm: 30, dailyRequests: 14400, pricingNote: "$0.00" },
  { id: "gemini-2.5-pro-preview-05-06", displayName: "Gemini 2.5 Pro Preview (05-06)", rpm: 5, dailyRequests: 25 },
  // Modelos eliminados de la selección original más amplia:
  // { id: "gemma-3n-e4b-it", displayName: "Gemma 3n E4B", rpm: 30, dailyRequests: 14400, pricingNote: "$0.00" },
  // { id: "gemini-1.5-flash-8b", displayName: "Gemini 1.5 Flash-8B", rpm: 15, dailyRequests: 1500 },
  // { id: "gemini-2.5-flash-preview-05-20", displayName: "Gemini 2.5 Flash Preview (05-20)", rpm: 10, dailyRequests: 500 }, // Mantenido uno de los Pro Preview
  // { id: "gemini-2.5-flash-preview-04-17", displayName: "Gemini 2.5 Flash Preview (04-17)", rpm: 10, dailyRequests: 500 },
];

const DEFAULT_CHAT_MODEL_ID = "gemini-1.5-flash-latest";


const ChatWithPdfScreen: React.FC = () => {
  const { pdfId: routePdfId } = useParams<{ pdfId: string }>();
  const navigate = useNavigate();

  const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
  const [loadingPdfDetails, setLoadingPdfDetails] = useState(true);
  const [errorPdfDetails, setErrorPdfDetails] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  const [speechSynthesisEnabled, setSpeechSynthesisEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [chatError, setChatError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'es' | 'en'>('es');
  const [selectedChatModelId, setSelectedChatModelId] = useState<string>(DEFAULT_CHAT_MODEL_ID);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = currentLanguage === 'es' ? 'es-ES' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = (event: any) => {
        console.error('Error en SpeechRecognition:', event.error);
        let errorMessage = "Error desconocido en reconocimiento de voz.";
        if (event.error === 'no-speech') errorMessage = "No se detectó voz.";
        else if (event.error === 'audio-capture') errorMessage = "Error al capturar audio.";
        else if (event.error === 'not-allowed') errorMessage = "Permiso para micrófono denegado.";
        setChatError(errorMessage);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    } else {
      console.warn('SpeechRecognition no es soportado.');
    }
  }, [currentLanguage]);


  useEffect(() => {
    if (!routePdfId) {
      setErrorPdfDetails("ID de PDF no proporcionado.");
      setLoadingPdfDetails(false);
      navigate('/dashboard');
      return;
    }
    const fetchDetails = async () => {
      setLoadingPdfDetails(true);
      setErrorPdfDetails(null);
      try {
        const details = await getPdfById(routePdfId);
        if (details) {
          setPdfDetails(details);
          const langDisplay = currentLanguage === 'es' ? 'Español' : 'Inglés';
          const currentModelInfo = AVAILABLE_CHAT_MODELS_INFO.find(m => m.id === selectedChatModelId);
          const modelDisplayName = currentModelInfo?.displayName || selectedChatModelId;

          const initialBotMessageText = `¡Hola! Soy tu asistente para el documento "${details.titulo || details.nombreArchivoOriginal}". Pregúntame lo que necesites saber sobre su contenido. (Modelo: ${modelDisplayName}, Idioma: ${langDisplay})`;
          
          if (messages.length === 0 || 
              (messages.length > 0 && messages[0].sender === 'bot' && messages[0].text !== initialBotMessageText)
            ) {
            const initialBotMessage: Message = {
                id: crypto.randomUUID(),
                text: initialBotMessageText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages([initialBotMessage]);
          }
        } else {
          setErrorPdfDetails(`No se encontró el PDF con ID: ${routePdfId}.`);
          setMessages([]);
        }
      } catch (err) {
        console.error("Error fetching PDF details:", err);
        setErrorPdfDetails("Error al cargar la información del PDF.");
        setMessages([]);
      } finally {
        setLoadingPdfDetails(false);
      }
    };
    fetchDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePdfId, navigate, currentLanguage, selectedChatModelId]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!speechSynthesisEnabled && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      setIsSpeechPaused(false);
    }
  }, [speechSynthesisEnabled]);

  const speakText = (messageId: string, text: string) => {
    if (!speechSynthesisEnabled || !('speechSynthesis' in window)) {
      setChatError("Síntesis de voz no soportada o deshabilitada.");
      return;
    }
    if (utteranceRef.current && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = new SpeechSynthesisUtterance(text);
    utteranceRef.current.lang = currentLanguage === 'es' ? 'es-ES' : 'en-US';
    utteranceRef.current.onstart = () => { setSpeakingMessageId(messageId); setIsSpeechPaused(false); };
    utteranceRef.current.onend = () => { setSpeakingMessageId(null); setIsSpeechPaused(false); utteranceRef.current = null; };
    utteranceRef.current.onerror = (event) => {
      console.error("Error en SpeechSynthesis:", event);
      setChatError("Error al reproducir voz.");
      setSpeakingMessageId(null); setIsSpeechPaused(false); utteranceRef.current = null;
    };
    window.speechSynthesis.speak(utteranceRef.current);
  };

  const handlePlayPauseAudio = (messageId: string, text: string) => {
    if (!speechSynthesisEnabled) return;
    if (speakingMessageId === messageId) {
      if (window.speechSynthesis.speaking && !isSpeechPaused) { window.speechSynthesis.pause(); setIsSpeechPaused(true); }
      else if (window.speechSynthesis.paused && isSpeechPaused) { window.speechSynthesis.resume(); setIsSpeechPaused(false); }
      else { speakText(messageId, text); }
    } else {
      if (window.speechSynthesis.speaking || window.speechSynthesis.paused) { window.speechSynthesis.cancel(); }
      speakText(messageId, text);
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoadingResponse || !pdfDetails || !routePdfId) {
      if (!routePdfId) setChatError("No se pudo obtener el ID del PDF para el chat.");
      return;
    }
    setChatError(null);
    const userMessage: Message = {
      id: crypto.randomUUID(), text: trimmedInput, sender: 'user', timestamp: new Date(),
    };
    
    const messagesForHistory = messages.filter(msg => {
      if (messages.length === 1 && msg.sender === 'bot' && msg.text.startsWith("¡Hola! Soy tu asistente")) {
        return false; 
      }
      if (msg.sender === 'bot' && (
          msg.text.toLowerCase().includes("error al procesar") && msg.text.includes("429") ||
          msg.text.toLowerCase().includes("límite de tasa excedido") ||
          msg.text.toLowerCase().includes("se ha alcanzado el límite de solicitudes")
         )
        ) {
          return false;
      }
      return true;
    });

    const historyForBackend: BackendMessageInput[] = messagesForHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setUserInput('');
    setIsLoadingResponse(true);

    let botSources: SourceDocumentFE[] | undefined = undefined;
    let addBotMessageToHistory = true;
    let finalBotText = "Lo siento, no pude procesar tu solicitud en este momento.";

    const bodyPayload = {
      user_question: trimmedInput,
      language: currentLanguage,
      model_id: selectedChatModelId,
      chat_history: historyForBackend
    };
    console.log("Enviando a FastAPI:", { routePdfId, bodyPayload });

    try {
      const apiUrl = `${FASTAPI_BACKEND_URL}/chat-rag/${encodeURIComponent(routePdfId)}/`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorDetail = responseData?.detail || responseData?.error?.message || `Error del servidor: ${response.statusText} (${response.status})`;
        
        if (response.status === 429) {
            const currentModelInfo = AVAILABLE_CHAT_MODELS_INFO.find(m => m.id === selectedChatModelId);
            const modelNameForError = currentModelInfo?.displayName || selectedChatModelId;
            finalBotText = `Se ha alcanzado el límite de solicitudes para el modelo "${modelNameForError}". Por favor, inténtalo de nuevo en un minuto o selecciona otro modelo.`;
            setChatError(finalBotText); 
            addBotMessageToHistory = false; 
        } else {
            finalBotText = `Error del servidor: ${errorDetail}`;
            setChatError(finalBotText);
        }
      } else { 
        if (responseData.answer) {
          finalBotText = responseData.answer;
          botSources = responseData.sources;
        } else {
          finalBotText = "Respuesta inesperada del asistente RAG.";
          setChatError(finalBotText);
        }
      }
    } catch (error: any) { 
      console.error("Error llamando a FastAPI /chat-rag/:", error);
      finalBotText = `Error de conexión o al contactar al asistente RAG: ${error.message || "Error desconocido."}`;
      setChatError(finalBotText);
      addBotMessageToHistory = false; 
    } finally {
      if(addBotMessageToHistory) {
        const botMessage: Message = {
          id: crypto.randomUUID(), text: finalBotText, sender: 'bot', timestamp: new Date(), sources: botSources,
        };
        setMessages(prevMessages => [...prevMessages, botMessage]);
      }
      setIsLoadingResponse(false);
    }
  };

   const toggleListen = () => {
    if (!recognitionRef.current) { setChatError("Reconocimiento de voz no disponible."); return; }
    setChatError(null);
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else {
      try { recognitionRef.current.lang = currentLanguage === 'es' ? 'es-ES' : 'en-US'; recognitionRef.current.start(); setIsListening(true); }
      catch (err) { console.error("Error al iniciar reconocimiento:", err); setChatError("No se pudo iniciar reconocimiento de voz."); setIsListening(false); }
    }
  };

  const toggleSpeechSynthesis = () => {
    setChatError(null);
    setSpeechSynthesisEnabled(prev => {
      const newState = !prev;
      if (!newState && window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); setSpeakingMessageId(null); setIsSpeechPaused(false); }
      return newState;
    });
  };

  const handleToggleLanguage = () => {
    setCurrentLanguage(prev => {
        const newLang = prev === 'es' ? 'en' : 'es';
        if (recognitionRef.current) { recognitionRef.current.lang = newLang === 'es' ? 'es-ES' : 'en-US'; }
        setChatError(null);
        return newLang;
    });
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = event.target.value;
    // **Asegurarse de que el modelo seleccionado sea válido antes de actualizar el estado**
    if (AVAILABLE_CHAT_MODELS_INFO.find(model => model.id === newModelId)) {
        setSelectedChatModelId(newModelId);
    } else {
        // Si el modelo no está en la lista (podría pasar si la lista cambia dinámicamente y el estado no se actualiza)
        // se podría volver al default o loguear un error.
        console.warn(`Modelo ID "${newModelId}" no encontrado en AVAILABLE_CHAT_MODELS_INFO. Volviendo al default.`);
        setSelectedChatModelId(DEFAULT_CHAT_MODEL_ID);
    }
    setChatError(null);
  };

  // **Asegurar que el selectedChatModelId siempre sea uno válido de la lista al cargar**
  useEffect(() => {
    const isValidModelSelected = AVAILABLE_CHAT_MODELS_INFO.some(model => model.id === selectedChatModelId);
    if (!isValidModelSelected && AVAILABLE_CHAT_MODELS_INFO.length > 0) {
        // Si el modelo seleccionado actualmente no está en la nueva lista depurada
        // (y la lista no está vacía), selecciona el primero de la lista depurada o el default.
        const defaultIsInNewList = AVAILABLE_CHAT_MODELS_INFO.some(model => model.id === DEFAULT_CHAT_MODEL_ID);
        setSelectedChatModelId(defaultIsInNewList ? DEFAULT_CHAT_MODEL_ID : AVAILABLE_CHAT_MODELS_INFO[0].id);
    } else if (AVAILABLE_CHAT_MODELS_INFO.length === 0) {
        // Manejar el caso de que la lista de modelos esté vacía (aunque no debería pasar con la lista hardcodeada)
        console.error("La lista de modelos disponibles (AVAILABLE_CHAT_MODELS_INFO) está vacía.");
        setChatError("No hay modelos de IA disponibles para seleccionar.");
    }
  }, []); // Se ejecuta solo una vez al montar el componente


  if (loadingPdfDetails) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4"><Loader2 className="animate-spin h-12 w-12 text-sky-500" /><p className="mt-4">Cargando detalles del PDF...</p></div>;
  if (errorPdfDetails) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center"><AlertTriangle className="h-16 w-16 text-red-500 mb-4" /><h2 className="text-2xl mb-3">Error al Cargar PDF</h2><p className="mb-6">{errorPdfDetails}</p><Link to="/dashboard" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg">Volver al Dashboard</Link></div>;
  if (!pdfDetails) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4"><FileText size={48} className="text-slate-500 mb-4" /><p>Documento PDF no encontrado.</p><Link to="/dashboard" className="mt-4 text-sky-400">Volver al Dashboard</Link></div>;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 font-sans">
      <header className="bg-slate-800/80 backdrop-blur-md shadow-lg p-3 sm:p-4 sticky top-0 z-20" style={{ '--header-height': 'auto' } as React.CSSProperties}>
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="flex w-full sm:w-auto items-center justify-between">
            <Link to="/dashboard" className="flex items-center text-sky-400 hover:text-sky-300 transition-colors group p-2 rounded-md hover:bg-slate-700/50">
              <ArrowLeft size={20} className="mr-1 sm:mr-2 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline text-sm">Volver</span>
            </Link>
            <div className="sm:hidden flex items-center gap-1">
              <button onClick={handleToggleLanguage} className="p-2 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-sky-300" title={`Idioma (actual: ${currentLanguage.toUpperCase()})`}><Languages size={18} /></button>
              <button onClick={toggleSpeechSynthesis} className={`p-2 rounded-md hover:bg-slate-700/50 ${speechSynthesisEnabled ? 'text-green-400' : 'text-slate-500'}`} title={speechSynthesisEnabled ? "Desactivar voz" : "Activar voz"}>{speechSynthesisEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            </div>
          </div>
          <div className="flex items-center min-w-0 text-center flex-grow justify-center order-first sm:order-none mt-2 sm:mt-0">
            <FileText size={20} className="text-sky-400 mr-2 shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold text-slate-200 truncate" title={pdfDetails?.titulo ?? pdfDetails?.nombreArchivoOriginal ?? 'Documento'}>
              Chat: {pdfDetails?.titulo ?? pdfDetails?.nombreArchivoOriginal ?? 'Documento'}
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-1 sm:gap-2">
            <button onClick={handleToggleLanguage} className="p-2 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-sky-300 flex items-center" title={`Idioma (actual: ${currentLanguage.toUpperCase()})`}><Languages size={20} className="mr-1 sm:mr-1.5"/><span className="text-xs hidden md:inline">{currentLanguage.toUpperCase()}</span></button>
            <button onClick={toggleSpeechSynthesis} className={`p-2 rounded-md hover:bg-slate-700/50 ${speechSynthesisEnabled ? 'text-green-400' : 'text-slate-500'}`} title={speechSynthesisEnabled ? "Desactivar voz" : "Activar voz"}>{speechSynthesisEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          </div>
        </div>
        <div className="container mx-auto mt-2 pb-2 border-t border-slate-700/50 pt-2">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <Settings size={14} className="text-slate-400"/>
                    <label htmlFor="modelSelector" className="text-slate-300">Modelo IA:</label>
                    <select
                        id="modelSelector"
                        value={selectedChatModelId}
                        onChange={handleModelChange}
                        className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-md p-1.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 appearance-none"
                        style={{minWidth: '200px'}}
                    >
                        {AVAILABLE_CHAT_MODELS_INFO.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.displayName}{model.isAlias ? ' (latest)' : ''} ({model.rpm} RPM, {model.dailyRequests}/día{model.pricingNote ? ` - ${model.pricingNote}` : ''})
                        </option>
                        ))}
                    </select>
                </div>
                 <p className="text-slate-500 text-xxs sm:ml-auto hidden md:block">ID del PDF: {routePdfId}</p>
            </div>
        </div>
      </header>

      {chatError && (
         <div className="container mx-auto p-2 text-center sticky top-[var(--header-height,100px)] z-10 animate-modalEnter" style={{top: `calc(${chatContainerRef.current?.parentElement?.offsetTop || 100}px + 1rem)` }}>
          <div className="bg-red-800/80 backdrop-blur-sm text-red-200 p-2.5 rounded-lg text-sm shadow-lg flex items-center justify-between">
            <div className="flex items-center"><AlertTriangle size={18} className="mr-2 shrink-0"/> {chatError}</div>
            <button onClick={() => setChatError(null)} className="text-red-300 hover:text-red-100 p-1 rounded-full hover:bg-red-700/50"><IconX size={16}/></button>
          </div>
        </div>
      )}

      <main ref={chatContainerRef} className="flex-grow container mx-auto p-4 space-y-4 overflow-y-auto pb-28 md:pb-24">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl p-3 rounded-xl shadow-md text-sm break-words ${msg.sender === 'user' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
              <div className="flex items-center mb-1.5">
                {msg.sender === 'bot' && <Bot size={16} className="mr-2 text-sky-400 shrink-0" />}
                {msg.sender === 'user' && <User size={16} className="mr-2 text-slate-300 shrink-0" />}
                <p className="text-xs font-semibold">{msg.sender === 'user' ? 'Tú' : 'EduPDF Bot'}</p>
                {msg.sender === 'bot' && (
                    <button
                        onClick={() => handlePlayPauseAudio(msg.id, msg.text)}
                        className="ml-auto p-1 text-slate-400 hover:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={speakingMessageId === msg.id && !isSpeechPaused ? "Pausar" : (speakingMessageId === msg.id && isSpeechPaused ? "Reanudar" : "Reproducir")}
                        disabled={!speechSynthesisEnabled}
                    >
                      {speakingMessageId === msg.id && !isSpeechPaused
                        ? <Pause size={14} />
                        : <Play size={14} />}
                    </button>
                )}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-600/70">
                  <h4 className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center"><BookText size={14} className="mr-1.5 text-sky-400"/>Fuentes:</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar-xs pr-1">
                    {msg.sources.map((source, index) => (
                      <details key={index} className="bg-slate-600/50 p-2 rounded text-xxs text-slate-300">
                        <summary className="cursor-pointer hover:text-sky-300 transition-colors">Fuente {index + 1} (Página: {source.metadata?.page_number || source.metadata?.page || 'N/A'})</summary>
                        <p className="mt-1 pt-1 border-t border-slate-500/50 whitespace-pre-wrap leading-snug">{source.page_content.substring(0, 200)}{source.page_content.length > 200 ? '...' : ''}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xxs text-right mt-1.5 opacity-60">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {isLoadingResponse && (
            <div className="flex justify-start">
                <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl p-3 rounded-xl shadow-md bg-slate-700 text-slate-200 rounded-bl-none">
                <div className="flex items-center"><Bot size={16} className="mr-2 text-sky-400 shrink-0" /><Loader2 className="animate-spin h-4 w-4 text-sky-400" /><span className="ml-2 text-sm italic">EduPDF Bot está pensando...</span></div>
                </div>
            </div>
        )}
      </main>

      <footer className="bg-slate-800/90 backdrop-blur-sm p-3 sm:p-4 border-t border-slate-700 fixed bottom-0 left-0 right-0 z-10">
        <form onSubmit={handleSendMessage} className="container mx-auto flex items-center space-x-2 sm:space-x-3">
          <button type="button" onClick={toggleListen} className={`p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center aspect-square ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`} disabled={isLoadingResponse} title={isListening ? "Detener grabación" : "Grabar pregunta"}><Mic size={20} /></button>
          <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Escribe tu pregunta o usa el micrófono..." className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm placeholder-slate-400 text-slate-100" disabled={isLoadingResponse} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}/>
          <button type="submit" disabled={!userInput.trim() || isLoadingResponse} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center aspect-square" aria-label="Enviar mensaje">{isLoadingResponse ? <Loader2 className="animate-spin h-5 w-5" /> : <Send size={20} />}</button>
        </form>
      </footer>
    </div>
  );
};

export default ChatWithPdfScreen;
