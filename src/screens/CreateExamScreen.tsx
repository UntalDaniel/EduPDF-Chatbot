// src/screens/CreateExamScreen.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { db, auth as firebaseAuthInstance } from '../firebase/firebaseConfig';
import { getPdfById } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';
import {
    QuestionConfig,
    ExamGenerationRequestData,
    GeneratedExamData,
    Question as QuestionType,
    TrueFalseQuestion, 
    MultipleChoiceQuestion, 
    OpenQuestion, 
    ExamForFirestore
} from '../types/examTypes'; 
// MessageSquarePlus eliminado de la siguiente línea si no se usa
import { ArrowLeft, Settings, FileText, Loader2, AlertTriangle, Info, CheckCircle2, Trash2, Download, Save, Send, ListChecks, ChevronDown, ChevronUp, RefreshCw, Edit3 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; 

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const AVAILABLE_EXAM_MODELS = [
    { id: "gemini-1.5-flash-latest", displayName: "Gemini 1.5 Flash (Rápido y Eficiente)" },
    { id: "gemini-1.5-pro-latest", displayName: "Gemini 1.5 Pro (Más Potente)" },
];
const DEFAULT_EXAM_MODEL_ID = AVAILABLE_EXAM_MODELS[0].id;

const FASTAPI_BACKEND_URL = process.env.NODE_ENV === 'development'
    ? "http://localhost:8000"
    : "TU_URL_DE_BACKEND_FASTAPI_DESPLEGADO"; 

const EXAM_INCLUDE_EXPLANATIONS_IN_PDF_FRONTEND = false; 

const CreateExamScreen: React.FC = () => {
    const { pdfId } = useParams<{ pdfId: string }>();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
    const [loadingPdfDetails, setLoadingPdfDetails] = useState(true);
    const [errorPdfDetails, setErrorPdfDetails] = useState<string | null>(null);

    const [examTitle, setExamTitle] = useState<string>('');
    const [pdfExamTitle, setPdfExamTitle] = useState<string>('');
    const [pdfTeacherName, setPdfTeacherName] = useState<string>('');

    const [numVfQuestions, setNumVfQuestions] = useState<number>(3);
    const [numMcQuestions, setNumMcQuestions] = useState<number>(3);
    const [numOpenQuestions, setNumOpenQuestions] = useState<number>(0); 
    
    const [difficulty, setDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
    const [language, setLanguage] = useState<string>('es');
    const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_EXAM_MODEL_ID);

    const [generatedExam, setGeneratedExam] = useState<GeneratedExamData | null>(null);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [editedQuestions, setEditedQuestions] = useState<QuestionType[]>([]);
    const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);
    const [editingOption, setEditingOption] = useState<{ questionId: string; optionIndex: number } | null>(null);

    useEffect(() => {
        if (!firebaseAuthInstance) return;
        const unsubscribe = firebaseAuthInstance.onAuthStateChanged(user => {
            setCurrentUser(user);
            if (user) {
                setPdfTeacherName(user.displayName || user.email || 'Docente');
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!pdfId) {
            setErrorPdfDetails("No se proporcionó un ID de PDF.");
            setLoadingPdfDetails(false);
            navigate("/dashboard");
            return;
        }
        if (!db) {
            setErrorPdfDetails("Servicio de base de datos no disponible.");
            setLoadingPdfDetails(false);
            return;
        }
        const fetchDetails = async () => {
            setLoadingPdfDetails(true);
            setErrorPdfDetails(null);
            try {
                const details = await getPdfById(pdfId);
                if (details) {
                    setPdfDetails(details);
                    const baseTitle = `Examen para "${details.titulo || details.nombreArchivoOriginal}"`;
                    setExamTitle(baseTitle);
                    setPdfExamTitle(baseTitle);
                } else {
                    setErrorPdfDetails("PDF no encontrado.");
                }
            } catch (err) {
                console.error("Error fetching PDF details:", err);
                setErrorPdfDetails("Error al cargar los detalles del PDF.");
            } finally {
                setLoadingPdfDetails(false);
            }
        };
        fetchDetails();
    }, [pdfId, navigate]);

    useEffect(() => {
        if (generatedExam?.questions) {
            const processedQuestions = generatedExam.questions.map(q => ({
                ...q,
                text: (q.text === undefined || q.text === null || String(q.text).trim() === "") 
                      ? "[Texto de pregunta no disponible]" 
                      : String(q.text),
            }));
            setEditedQuestions(Array.isArray(processedQuestions) ? [...processedQuestions] : []);
        } else if (generatedExam && !generatedExam.questions) {
            setEditedQuestions([]);
        }
    }, [generatedExam]);

    const handleGenerateExam = async (event?: FormEvent) => {
        if (event) event.preventDefault();
        if (!pdfId) {
            setGenerationError("ID de PDF no disponible.");
            return;
        }
        if ((numVfQuestions + numMcQuestions + numOpenQuestions) <= 0) { 
            setGenerationError("Por favor, especifica al menos una pregunta para generar.");
            return;
        }
        if (!examTitle.trim()) {
            setGenerationError("Por favor, ingresa un título para el examen.");
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);
        setGeneratedExam(null);
        setEditedQuestions([]);
        setSaveSuccessMessage(null);
        setSaveError(null);

        const questionConfig: QuestionConfig = {
            vf_questions: numVfQuestions,
            mc_questions: numMcQuestions,
            open_questions: numOpenQuestions, 
        };

        const requestData: ExamGenerationRequestData = {
            pdf_id: pdfId,
            title: examTitle,
            question_config: questionConfig,
            difficulty: difficulty,
            language: language,
            model_id: selectedModelId
        };

        try {
            const response = await fetch(`${FASTAPI_BACKEND_URL}/exams/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
            });
            const data: GeneratedExamData = await response.json();
            if (!response.ok) {
                throw new Error(data.error || (data as any).detail || `Error ${response.status} del servidor.`);
            }
            if (data.error) {
                 setGenerationError(data.error);
                 setGeneratedExam(data); 
            } else if (!data.questions || data.questions.length === 0) {
                setGenerationError("El modelo no generó ninguna pregunta con la configuración actual. Intenta ajustar los parámetros o el contenido del PDF.");
                setGeneratedExam(data);
            } else {
                setGeneratedExam(data);
                setPdfExamTitle(data.title);
            }
        } catch (err: any) {
            console.error("Error generando examen:", err);
            setGenerationError(err.message || 'Ocurrió un error desconocido al generar el examen.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveExam = async () => {
        if (!currentUser || !generatedExam || editedQuestions.length === 0) {
            setSaveError("No hay examen con preguntas para guardar o no has iniciado sesión.");
            return;
        }
        if (!db) {
            setSaveError("Servicio de base de datos no disponible.");
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccessMessage(null);
        const examToSave: ExamForFirestore = {
            userId: currentUser.uid,
            pdfId: generatedExam.pdf_id,
            title: examTitle,
            difficulty: generatedExam.difficulty,
            config: { 
                vf_questions: editedQuestions.filter(q => q.type === 'V_F').length,
                mc_questions: editedQuestions.filter(q => q.type === 'MC').length,
                open_questions: editedQuestions.filter(q => q.type === 'OPEN').length, 
            },
            questions: editedQuestions, 
            createdAt: serverTimestamp(),
            language: language, 
            model_id_used: selectedModelId 
        };
        try {
            const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'exams'), examToSave);
            setSaveSuccessMessage(`Examen "${examToSave.title}" guardado con ID: ${docRef.id}`);
        } catch (err: any) {
            console.error("Error guardando examen en Firestore:", err);
            setSaveError('Error al guardar el examen en Firestore: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuestionTextChange = (id: string, newText: string) => {
        setEditedQuestions(prev => prev.map(q => q.id === id ? {...q, text: newText} : q));
    };

    const handleDeleteQuestion = (id: string) => {
        setEditedQuestions(prev => prev.filter(q => q.id !== id));
    };

    const handleRegenerateQuestion = async (questionId: string) => {
        if (!pdfId || !generatedExam) return;
        const questionToRegenerate = editedQuestions.find(q => q.id === questionId);

        if (!questionToRegenerate) {
            console.warn(`Regenerate: Question with ID ${questionId} not found.`);
            return;
        }
        
        const questionTypeForLog = 'type' in questionToRegenerate ? (questionToRegenerate as QuestionType).type : 'UNKNOWN';
        console.log(`Simulando regeneración para pregunta ID: ${questionId}, Tipo: ${questionTypeForLog}`);

        setRegeneratingQuestionId(questionId);
        
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        const originalText = questionToRegenerate.text === "[Texto de pregunta no disponible]" ? "Pregunta original" : questionToRegenerate.text;
        const newText = `(Regenerada) ${originalText.substring(0,20)}... ${Date.now()}`;
        let newQuestion: QuestionType | undefined = undefined;

        if (questionToRegenerate.type === "V_F") {
            const tfQuestion = questionToRegenerate as TrueFalseQuestion;
            newQuestion = {
                ...tfQuestion,
                id: uuidv4(), 
                text: newText,
                correct_answer: !tfQuestion.correct_answer, 
                explanation: `Explicación regenerada para: ${newText.substring(0,15)}...`
            };
        } else if (questionToRegenerate.type === "MC") {
            const mcQuestion = questionToRegenerate as MultipleChoiceQuestion;
            newQuestion = {
                ...mcQuestion, 
                id: uuidv4(),
                text: newText,
                options: [...mcQuestion.options.slice(1), mcQuestion.options[0]], 
                correct_answer_index: (mcQuestion.correct_answer_index + 1) % mcQuestion.options.length,
                explanation: `Explicación regenerada para: ${newText.substring(0,15)}...`
            };
        } else if (questionToRegenerate.type === "OPEN") { 
            const openQ = questionToRegenerate as OpenQuestion;
            newQuestion = {
                ...openQ,
                id: uuidv4(),
                text: newText,
                explanation: `Guía de respuesta regenerada para: ${newText.substring(0,15)}...`
            };
        }else {
            const unknownQuestion = questionToRegenerate as any; 
            console.warn("Regenerando pregunta de tipo desconocido o no manejado explícitamente:", unknownQuestion.type);
            newQuestion = { 
                id: uuidv4(), 
                text: newText,
                type: unknownQuestion.type || 'UNKNOWN', 
                ...(unknownQuestion as object) 
            } as QuestionType; 
        }
        
        if (newQuestion) { 
            setEditedQuestions(prev => prev.map(q => (q.id === questionId ? newQuestion : q)));
        }
        setRegeneratingQuestionId(null);
        alert(`Funcionalidad de regenerar pregunta (ID: ${questionId}) pendiente de implementación completa en backend. Se reemplazó con datos simulados.`);
    };
    
    const uuidv4 = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const handleTfAnswerChange = (questionId: string, newAnswer: boolean) => {
        setEditedQuestions(prev =>
            prev.map(q => {
                if (q.id === questionId && q.type === 'V_F') {
                    return { ...q, correct_answer: newAnswer };
                }
                return q;
            })
        );
    };

    const handleMcOptionTextChange = (questionId: string, optionIndex: number, newOptionText: string) => {
        setEditedQuestions(prev =>
            prev.map(q => {
                if (q.id === questionId && q.type === 'MC') {
                    const updatedOptions = [...(q as MultipleChoiceQuestion).options];
                    updatedOptions[optionIndex] = newOptionText;
                    return { ...q, options: updatedOptions };
                }
                return q;
            })
        );
         setEditingOption(null); 
    };

    const handleMcCorrectAnswerChange = (questionId: string, newCorrectIndex: number) => {
        setEditedQuestions(prev =>
            prev.map(q => {
                if (q.id === questionId && q.type === 'MC') {
                    return { ...q, correct_answer_index: newCorrectIndex };
                }
                return q;
            })
        );
    };

    const handleDownloadPdf = () => {
        if (editedQuestions.length === 0) {
            alert("No hay preguntas para descargar.");
            return;
        }
        const doc = new jsPDF() as jsPDFWithAutoTable;
        doc.setFontSize(18);
        doc.text(pdfExamTitle || examTitle, 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Docente: ${pdfTeacherName || (currentUser?.displayName || 'N/A')}`, 105, 30, { align: 'center' });
        doc.text("Nombre del Alumno: _____________________________", 20, 45);
        doc.text("Fecha: ______________", 140, 45);
        doc.setFontSize(11);
        let yPos = 60; 

        editedQuestions.forEach((q, index) => {
            if (yPos > 260) { 
                doc.addPage();
                yPos = 20;
            }
            
            const questionTextContent = (q.text && q.text.trim() !== "" && q.text !== "[Texto de pregunta no disponible]" && q.text !== "undefined") 
                ? q.text 
                : "_________________________________________"; 
            const questionTextForPdf = `${index + 1}. ${questionTextContent}`;
            const splitQuestionText = doc.splitTextToSize(questionTextForPdf, 170); 
            doc.text(splitQuestionText, 20, yPos);
            yPos += (splitQuestionText.length * 7); 

            if (q.type === "V_F") {
                doc.text("(   ) Verdadero     (   ) Falso", 25, yPos);
                yPos += 10;
            } else if (q.type === "MC") {
                const mcQuestion = q as MultipleChoiceQuestion;
                mcQuestion.options.forEach((option, i) => {
                    if (yPos > 270) { doc.addPage(); yPos = 20; }
                    doc.text(`${String.fromCharCode(97 + i)}) ${option}`, 25, yPos);
                    yPos += 7;
                });
            } else if (q.type === "OPEN") {
                yPos += 5; 
                for (let i = 0; i < 3; i++) { 
                    if (yPos > 270) { doc.addPage(); yPos = 20; }
                    doc.line(25, yPos, 190, yPos); 
                    yPos += 7;
                }
                yPos += 3; 
            }
            
            if (q.explanation && EXAM_INCLUDE_EXPLANATIONS_IN_PDF_FRONTEND) { 
                 if (yPos > 260) { doc.addPage(); yPos = 20; }
                 doc.setFontSize(9);
                 doc.setTextColor(100); 
                 const splitExplanation = doc.splitTextToSize(`Explicación: ${q.explanation}`, 165);
                 doc.text(splitExplanation, 25, yPos);
                 yPos += (splitExplanation.length * 5) + 2;
                 doc.setFontSize(11);
                 doc.setTextColor(0); 
            }
            yPos += 7; 
        });
        
        doc.save(`${(pdfExamTitle || examTitle || 'examen').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    };

    if (loadingPdfDetails) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                <Loader2 className="animate-spin h-12 w-12 text-sky-500" />
                <p className="mt-4 text-lg">Cargando detalles del PDF...</p>
            </div>
        );
    }

    if (errorPdfDetails) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
                <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-2xl mb-3">Error al Cargar PDF</h2>
                <p className="mb-6">{errorPdfDetails}</p>
                <Link to="/dashboard" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg">Volver al Dashboard</Link>
            </div>
        );
    }
    
    // Mover la guarda de !pdfDetails aquí asegura que en el JSX principal, pdfDetails no es null.
    if (!pdfDetails) {
         return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                <FileText size={48} className="text-slate-500 mb-4" />
                <p>Detalles del PDF no encontrados o aún cargando. Si el error persiste, vuelve al dashboard.</p>
                <Link to="/dashboard" className="mt-4 text-sky-400">Volver al Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-8 font-sans">
            <header className="mb-6 md:mb-8">
                <div className="container mx-auto">
                    <Link to="/dashboard" className="inline-flex items-center text-sky-400 hover:text-sky-300 transition-colors group text-sm">
                        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-0.5 transition-transform" />
                        Volver al Panel
                    </Link>
                </div>
            </header>

            <main className="container mx-auto">
                <div className="bg-slate-800/70 border border-slate-700/80 p-6 md:p-8 rounded-xl shadow-2xl max-w-4xl mx-auto">
                    <div className="flex items-center mb-6">
                        <ListChecks size={32} className="text-sky-400 mr-4 shrink-0" />
                        <h1 className="text-2xl md:text-3xl font-bold text-sky-300">Crear Nuevo Examen</h1>
                    </div>

                    {/* Ahora es seguro acceder a pdfDetails aquí porque la guarda anterior lo maneja */}
                    <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="flex items-start">
                            <FileText size={24} className="text-green-400 mr-3 mt-1 shrink-0" />
                            <div>
                                <h2 className="text-lg font-semibold text-green-300 mb-0.5">PDF Base:</h2>
                                <p className="text-slate-200 text-sm truncate" title={pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}>
                                    {pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}
                                </p>
                                <p className="text-xs text-slate-400">ID: {pdfDetails.id}</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleGenerateExam} className="space-y-6">
                        <div>
                            <label htmlFor="examTitle" className="block text-sm font-medium text-slate-300 mb-1.5">Título del Examen (para guardar y referencia)</label>
                            <input
                                type="text"
                                id="examTitle"
                                value={examTitle}
                                onChange={(e) => setExamTitle(e.target.value)}
                                required
                                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors placeholder-slate-500"
                                placeholder="Ej: Examen Parcial - Unidad 1"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                            <div>
                                <label htmlFor="numVfQuestions" className="block text-sm font-medium text-slate-300 mb-1.5">Nº Preguntas V/F</label>
                                <input type="number" id="numVfQuestions" value={numVfQuestions} onChange={(e) => setNumVfQuestions(Math.max(0, parseInt(e.target.value)))} min="0" max="10"
                                       className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"/>
                            </div>
                            <div>
                                <label htmlFor="numMcQuestions" className="block text-sm font-medium text-slate-300 mb-1.5">Nº Preguntas Opción Múltiple</label>
                                <input type="number" id="numMcQuestions" value={numMcQuestions} onChange={(e) => setNumMcQuestions(Math.max(0, parseInt(e.target.value)))} min="0" max="10"
                                       className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"/>
                            </div>
                            <div>
                                <label htmlFor="numOpenQuestions" className="block text-sm font-medium text-slate-300 mb-1.5">Nº Preguntas Abiertas</label>
                                <input type="number" id="numOpenQuestions" value={numOpenQuestions} onChange={(e) => setNumOpenQuestions(Math.max(0, parseInt(e.target.value)))} min="0" max="5" 
                                       className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"/>
                            </div>
                        </div>
                        
                        <button type="button" onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                                className="w-full text-sm text-sky-400 hover:text-sky-300 py-2 px-3 rounded-md bg-slate-700/50 hover:bg-slate-700 transition-colors flex items-center justify-center">
                            <Settings size={16} className="mr-2"/>
                            Opciones Avanzadas
                            {showAdvancedOptions ? <ChevronUp size={16} className="ml-1.5"/> : <ChevronDown size={16} className="ml-1.5"/>}
                        </button>

                        {showAdvancedOptions && (
                            <div className="p-4 border border-slate-600 rounded-lg bg-slate-700/30 space-y-4 animate-modalEnter">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                                    <div>
                                        <label htmlFor="difficulty" className="block text-sm font-medium text-slate-300 mb-1.5">Dificultad</label>
                                        <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'facil' | 'medio' | 'dificil')}
                                                className="w-full px-4 py-2.5 bg-slate-600 border border-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors">
                                            <option value="facil">Fácil</option>
                                            <option value="medio">Medio</option>
                                            <option value="dificil">Difícil</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="language" className="block text-sm font-medium text-slate-300 mb-1.5">Idioma</label>
                                        <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-600 border border-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors">
                                            <option value="es">Español</option>
                                            <option value="en">Inglés</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="modelId" className="block text-sm font-medium text-slate-300 mb-1.5">Modelo IA</label>
                                        <select id="modelId" value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-600 border border-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors">
                                            {AVAILABLE_EXAM_MODELS.map(model => (
                                                <option key={model.id} value={model.id}>{model.displayName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 flex items-center">
                                    <Info size={14} className="mr-1.5 shrink-0"/>
                                    La selección del modelo y el idioma pueden influir en la calidad y el estilo de las preguntas generadas.
                                </p>
                            </div>
                        )}
                        
                        <button type="submit" disabled={isGenerating || !currentUser}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                            {isGenerating ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Send size={18} className="mr-2" />}
                            {isGenerating ? 'Generando Examen...' : 'Generar Examen'}
                        </button>
                        {!currentUser && <p className="text-xs text-yellow-400 text-center mt-2">Debes iniciar sesión para generar un examen.</p>}
                    </form>

                     {generationError && (
                        <div className="mt-4 p-3 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center text-sm">
                            <AlertTriangle size={18} className="mr-2 shrink-0"/> <span>{generationError}</span>
                        </div>
                    )}
                    {saveSuccessMessage && (
                        <div className="mt-4 p-3 bg-green-700/30 text-green-300 border border-green-600/50 rounded-lg flex items-center text-sm">
                            <CheckCircle2 size={18} className="mr-2 shrink-0"/> <span>{saveSuccessMessage}</span>
                        </div>
                    )}
                    {saveError && (
                        <div className="mt-4 p-3 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center text-sm">
                            <AlertTriangle size={18} className="mr-2 shrink-0"/> <span>{saveError}</span>
                        </div>
                    )}


                    {generatedExam && editedQuestions.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-sky-300">Preguntas Generadas para "{generatedExam.title}"</h2>
                            <div className="space-y-5">
                                {editedQuestions.map((q, index) => (
                                    <div key={q.id} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-slate-200 flex-grow flex items-start">
                                                <span className="mr-2 pt-1">{index + 1}.</span>
                                                <textarea 
                                                    value={q.text || ''} 
                                                    onChange={(e) => handleQuestionTextChange(q.id, e.target.value)}
                                                    className="p-1 bg-slate-600/50 border border-slate-500 rounded-md w-full focus:ring-1 focus:ring-sky-400 resize-none text-sm"
                                                    rows={(q.text || '').length > 80 ? 3 : 2}
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-1 ml-2 shrink-0">
                                                <button onClick={() => handleRegenerateQuestion(q.id)} title="Regenerar Pregunta"
                                                        disabled={regeneratingQuestionId === q.id}
                                                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-700/50 rounded-md transition-colors flex items-center justify-center disabled:opacity-50">
                                                    {regeneratingQuestionId === q.id ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                                                </button>
                                                <button onClick={() => handleDeleteQuestion(q.id)} title="Eliminar Pregunta"
                                                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-700/50 rounded-md transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>

                                        {q.type === 'V_F' && (
                                            <div className="text-sm space-y-1 pl-6">
                                                <label className="block text-xs text-slate-400 mb-1">Respuesta Correcta:</label>
                                                <select 
                                                    value={(q as TrueFalseQuestion).correct_answer ? "true" : "false"}
                                                    onChange={(e) => handleTfAnswerChange(q.id, e.target.value === "true")}
                                                    className="p-1 bg-slate-600/70 border border-slate-500 rounded-md text-sm text-slate-200 focus:ring-1 focus:ring-sky-400"
                                                >
                                                    <option value="true">Verdadero</option>
                                                    <option value="false">Falso</option>
                                                </select>
                                            </div>
                                        )}
                                        {q.type === 'MC' && (
                                            <ul className="list-none pl-6 space-y-2 text-sm">
                                                {((q as MultipleChoiceQuestion).options || []).map((opt, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <input 
                                                            type="radio" 
                                                            name={`mc_correct_${q.id}`} 
                                                            id={`mc_correct_${q.id}_${i}`}
                                                            checked={i === (q as MultipleChoiceQuestion).correct_answer_index}
                                                            onChange={() => handleMcCorrectAnswerChange(q.id, i)}
                                                            className="form-radio h-4 w-4 text-sky-500 bg-slate-600 border-slate-500 focus:ring-sky-400"
                                                        />
                                                        <label htmlFor={`mc_correct_${q.id}_${i}`} className="flex-grow flex items-center">
                                                            <span className="mr-1">{String.fromCharCode(97 + i)})</span>
                                                            {editingOption?.questionId === q.id && editingOption?.optionIndex === i ? (
                                                                <input
                                                                    type="text"
                                                                    value={opt}
                                                                    onChange={(e) => handleMcOptionTextChange(q.id, i, e.target.value)}
                                                                    onBlur={() => setEditingOption(null)}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingOption(null); }}
                                                                    autoFocus
                                                                    className="flex-grow p-1 bg-slate-500 border border-slate-400 rounded-md text-sm"
                                                                />
                                                            ) : (
                                                                <span 
                                                                    className={`flex-grow p-1 rounded-md hover:bg-slate-600/50 cursor-text ${i === (q as MultipleChoiceQuestion).correct_answer_index ? 'text-green-400 font-semibold' : 'text-slate-300'}`}
                                                                    onClick={() => setEditingOption({ questionId: q.id, optionIndex: i })}
                                                                >
                                                                    {opt}
                                                                </span>
                                                            )}
                                                        </label>
                                                         <button 
                                                            onClick={() => setEditingOption({ questionId: q.id, optionIndex: i })} 
                                                            className="p-1 text-slate-400 hover:text-sky-300"
                                                            title="Editar opción"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {q.type === 'OPEN' && (
                                            <div className="text-sm space-y-1 pl-6 text-slate-400 italic">
                                                <p>(Pregunta Abierta)</p>
                                            </div>
                                        )}
                                        {q.explanation && ( 
                                            <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-600/50 pl-6">
                                                <Info size={12} className="inline mr-1 mb-0.5"/> 
                                                <i>Explicación/Guía: {q.explanation}</i>
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 space-y-4">
                                <h3 className="text-lg font-semibold text-sky-400">Opciones de Descarga PDF</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                                    <div>
                                        <label htmlFor="pdfExamTitle" className="block text-sm font-medium text-slate-300 mb-1">Título para el PDF del Examen</label>
                                        <input
                                            type="text"
                                            id="pdfExamTitle"
                                            value={pdfExamTitle}
                                            onChange={(e) => setPdfExamTitle(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:ring-1 focus:ring-sky-400"
                                            placeholder="Título que aparecerá en el PDF"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="pdfTeacherName" className="block text-sm font-medium text-slate-300 mb-1">Nombre del Docente para el PDF</label>
                                        <input
                                            type="text"
                                            id="pdfTeacherName"
                                            value={pdfTeacherName}
                                            onChange={(e) => setPdfTeacherName(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:ring-1 focus:ring-sky-400"
                                            placeholder="Nombre del docente"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={handleSaveExam} disabled={isSaving || !currentUser}
                                            className="w-full sm:w-auto flex-grow bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-colors disabled:opacity-60 flex items-center justify-center">
                                        {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <Save size={18} className="mr-2"/>}
                                        {isSaving ? 'Guardando...' : 'Guardar Examen en Mis Exámenes'}
                                    </button>
                                    <button onClick={handleDownloadPdf}
                                            disabled={editedQuestions.length === 0}
                                            className="w-full sm:w-auto flex-grow bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-colors flex items-center justify-center disabled:opacity-50">
                                        <Download size={18} className="mr-2"/> Descargar como PDF
                                    </button>
                                </div>
                            </div>
                             {!currentUser && <p className="text-xs text-yellow-400 text-center mt-2">Debes iniciar sesión para guardar el examen.</p>}
                        </div>
                    )}
                     {generatedExam && !generationError && editedQuestions.length === 0 && !isGenerating && (
                        <div className="mt-8 text-center text-slate-400">
                            <Info size={24} className="mx-auto mb-2"/>
                            <p>El modelo no generó preguntas con la configuración actual o el contenido del PDF.</p>
                            <p>Puedes intentar ajustar los parámetros (número de preguntas, dificultad) o usar un PDF con más texto.</p>
                        </div>
                    )}

                </div>
            </main>
            <footer className="text-center py-8 mt-12 text-sm text-slate-500 border-t border-slate-700/50">
                <p>&copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
};

export default CreateExamScreen;
