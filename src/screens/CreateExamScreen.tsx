// src/screens/CreateExamScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  Question,
  ExamGenerationRequestData,
  GeneratedExamData,
  ExamForFirestore,
  QuestionConfig,
  MultipleChoiceQuestion,
  TrueFalseQuestion
} from '../types/examTypes'; // Asegúrate que la ruta sea correcta
import { firestore } from '../firebase/firebaseConfig'; // Tu config de Firebase
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User, getAuth } from 'firebase/auth'; // Para obtener el UID del usuario

// URL de tu backend de FastAPI (ajusta si es necesario)
const FASTAPI_BACKEND_URL = 'http://localhost:8000';

// Mockup de PDFs disponibles (reemplaza con tu lógica real para obtener PDFs)
const availablePdfs = [
  { id: 'pdf_001', name: 'Introducción a la Biología Celular' },
  { id: 'pdf_002', name: 'Historia de la Filosofía Antigua' },
  { id: 'pdf_003', name: 'Principios de Termodinámica' },
];

const CreateExamScreen: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedPdfId, setSelectedPdfId] = useState<string>(availablePdfs[0]?.id || '');
  const [examTitle, setExamTitle] = useState<string>('Nuevo Examen');
  const [numVfQuestions, setNumVfQuestions] = useState<number>(2);
  const [numMcQuestions, setNumMcQuestions] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
  
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedExamId, setGeneratedExamId] = useState<string | null>(null); // Para el ID del examen después de guardar

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateExam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPdfId) {
      setError('Por favor, selecciona un PDF.');
      return;
    }
    if ((numVfQuestions + numMcQuestions) <= 0) {
        setError('Por favor, especifica al menos una pregunta para generar.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedQuestions([]);
    setGeneratedExamId(null);

    const questionConfig: QuestionConfig = {
      vf_questions: numVfQuestions,
      mc_questions: numMcQuestions,
    };

    const requestData: ExamGenerationRequestData = {
      pdf_id: selectedPdfId,
      // Podrías pasar un texto de ejemplo si tu backend lo necesita para la simulación inicial
      // sample_text_from_pdf: "Este es un texto de ejemplo para generar preguntas sobre la célula y la fotosíntesis.",
      title: examTitle,
      question_config: questionConfig,
      difficulty: difficulty,
    };

    try {
      const response = await fetch(`${FASTAPI_BACKEND_URL}/exams/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const data: GeneratedExamData = await response.json();
      setGeneratedQuestions(data.questions);
      // Aquí podrías establecer un exam_id temporal si el backend no lo devuelve antes de guardar
      // setGeneratedExamId(data.exam_id || `temp-${Date.now()}`); 
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al generar el examen.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExam = async () => {
    if (!currentUser) {
      setError('Debes iniciar sesión para guardar un examen.');
      return;
    }
    if (generatedQuestions.length === 0) {
      setError('No hay preguntas generadas para guardar.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const examToSave: ExamForFirestore = {
      userId: currentUser.uid,
      pdfId: selectedPdfId,
      title: examTitle,
      difficulty: difficulty,
      config: {
        vf_questions: numVfQuestions,
        mc_questions: numMcQuestions,
      },
      questions: generatedQuestions,
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(firestore, 'users', currentUser.uid, 'exams'), examToSave);
      setGeneratedExamId(docRef.id); // Guardamos el ID real de Firestore
      alert(`Examen guardado con ID: ${docRef.id}`);
      // Aquí podrías redirigir o limpiar el formulario
    } catch (err: any) {
      setError('Error al guardar el examen en Firestore.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para editar una pregunta (funcionalidad básica, se puede expandir)
  const handleEditQuestion = (questionId: string, newText: string) => {
    setGeneratedQuestions(prevQuestions => 
      prevQuestions.map(q => q.id === questionId ? { ...q, text: newText } : q)
    );
  };

  // Función para eliminar una pregunta
  const handleDeleteQuestion = (questionId: string) => {
    setGeneratedQuestions(prevQuestions => prevQuestions.filter(q => q.id !== questionId));
  };
  
  // Función para regenerar una pregunta (Placeholder - necesitaría lógica de backend)
  const handleRegenerateQuestion = (questionId: string) => {
    alert(`Funcionalidad "Regenerar Pregunta ${questionId}" no implementada en este paso.`);
    // Lógica futura: Llamar a un endpoint del backend para regenerar solo esta pregunta
    // similar a handleGenerateExam pero pasando el contexto de la pregunta a reemplazar.
  };


  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">Crear Nuevo Examen</h1>

      <form onSubmit={handleGenerateExam} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label htmlFor="examTitle" className="block text-gray-700 text-sm font-bold mb-2">
            Título del Examen:
          </label>
          <input
            type="text"
            id="examTitle"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="pdfSelect" className="block text-gray-700 text-sm font-bold mb-2">
            Seleccionar PDF Base:
          </label>
          <select
            id="pdfSelect"
            value={selectedPdfId}
            onChange={(e) => setSelectedPdfId(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            {availablePdfs.map(pdf => (
              <option key={pdf.id} value={pdf.id}>{pdf.name}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
                <label htmlFor="numVfQuestions" className="block text-gray-700 text-sm font-bold mb-2">
                Nº Preguntas Verdadero/Falso:
                </label>
                <input
                type="number"
                id="numVfQuestions"
                value={numVfQuestions}
                onChange={(e) => setNumVfQuestions(Math.max(0, parseInt(e.target.value)))}
                min="0"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
            </div>
            <div>
                <label htmlFor="numMcQuestions" className="block text-gray-700 text-sm font-bold mb-2">
                Nº Preguntas Opción Múltiple:
                </label>
                <input
                type="number"
                id="numMcQuestions"
                value={numMcQuestions}
                onChange={(e) => setNumMcQuestions(Math.max(0, parseInt(e.target.value)))}
                min="0"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
            </div>
        </div>


        <div className="mb-6">
          <label htmlFor="difficulty" className="block text-gray-700 text-sm font-bold mb-2">
            Nivel de Dificultad:
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'facil' | 'medio' | 'dificil')}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="facil">Fácil</option>
            <option value="medio">Medio</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
          >
            {isLoading ? 'Generando...' : 'Generar Preguntas'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-500 text-xs italic mt-4">{error}</p>}

      {generatedQuestions.length > 0 && (
        <div className="mt-8 bg-white shadow-md rounded px-8 pt-6 pb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Preguntas Generadas</h2>
          {generatedQuestions.map((q, index) => (
            <div key={q.id} className="mb-6 p-4 border border-gray-200 rounded">
              <p className="font-semibold text-gray-700">
                {index + 1}. {q.text} <span className="text-xs text-blue-500">({q.type === 'V_F' ? 'Verdadero/Falso' : 'Opción Múltiple'})</span>
              </p>
              {q.type === 'V_F' && (
                <p className="text-sm text-green-600">Respuesta Correcta: { (q as TrueFalseQuestion).correct_answer ? 'Verdadero' : 'Falso'}</p>
              )}
              {q.type === 'MC' && (
                <>
                  <ul className="list-disc list-inside pl-4 mt-2 text-sm">
                    {(q as MultipleChoiceQuestion).options.map((opt, i) => (
                      <li key={i} className={`${opt === (q as MultipleChoiceQuestion).correct_answer ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
                        {String.fromCharCode(97 + i)}) {opt}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-green-600 mt-1">Respuesta Correcta: {(q as MultipleChoiceQuestion).correct_answer}</p>
                </>
              )}
               {q.explanation && (
                <p className="text-xs text-gray-500 mt-1"><i>Explicación: {q.explanation}</i></p>
              )}
              <div className="mt-2 space-x-2">
                <button 
                    onClick={() => {
                        const newText = prompt("Editar texto de la pregunta:", q.text);
                        if (newText !== null) handleEditQuestion(q.id, newText);
                    }}
                    className="text-xs bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-1 px-2 rounded"
                >
                    Editar
                </button>
                <button 
                    onClick={() => handleRegenerateQuestion(q.id)}
                    className="text-xs bg-indigo-400 hover:bg-indigo-500 text-white font-semibold py-1 px-2 rounded"
                >
                    Regenerar
                </button>
                <button 
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded"
                >
                    Eliminar
                </button>
              </div>
            </div>
          ))}
          <div className="mt-6 flex space-x-4">
            <button
              onClick={handleSaveExam}
              disabled={isLoading || !!generatedExamId} // Deshabilitar si ya se guardó o está cargando
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
              {isLoading ? 'Guardando...' : (generatedExamId ? 'Examen Guardado' : 'Guardar Examen')}
            </button>
            <button
                // onClick={handleDownloadPdf} // Implementaremos esto después
                onClick={() => alert("Funcionalidad de descarga PDF pendiente.")}
                disabled={isLoading || !generatedQuestions.length}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
                Descargar como PDF (Pendiente)
            </button>
          </div>
          {generatedExamId && <p className="text-green-600 mt-2">Examen guardado en Firestore con ID: {generatedExamId}</p>}
        </div>
      )}
    </div>
  );
};

export default CreateExamScreen;

