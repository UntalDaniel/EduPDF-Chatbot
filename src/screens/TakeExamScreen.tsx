import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import StudentInfoForm from '../components/StudentInfoForm';

export interface Exam {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>;
  timeLimit: number; // en minutos
  createdAt: any;
  createdBy: string;
}

interface StudentResponse {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  correctAnswer: number;
}

const TakeExamScreen: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  // Cargar el examen
  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) return;
      
      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) {
          throw new Error('Examen no encontrado');
        }
        
        const examData = { id: examDoc.id, ...examDoc.data() } as Exam;
        setExam(examData);
        setTimeLeft(examData.timeLimit * 60); // Convertir a segundos
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar el examen:', err);
        setError('No se pudo cargar el examen. El enlace puede ser incorrecto o el examen ha sido eliminado.');
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId]);

  // Temporizador del examen
  useEffect(() => {
    if (!examStarted || timeLeft <= 0 || examSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, timeLeft, examSubmitted]);

  const handleStartExam = async (studentInfo: { name: string; lastName: string; email: string }) => {
    setExamStarted(true);
    // Aquí podrías guardar la información del estudiante en el estado o en Firestore
    console.log('Información del estudiante:', studentInfo);
  };

  const handleNextQuestion = () => {
    if (selectedOption === null || !exam) return;

    const currentQuestion = exam.questions[currentQuestionIndex];
    const response: StudentResponse = {
      questionIndex: currentQuestionIndex,
      selectedOption,
      isCorrect: selectedOption === currentQuestion.correctAnswer,
      correctAnswer: currentQuestion.correctAnswer
    };

    const newResponses = [...responses, response];
    setResponses(newResponses);
    setSelectedOption(null);

    if (currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmitExam();
    }
  };

  const handleSubmitExam = async () => {
    if (examSubmitted) return;
    
    setExamSubmitted(true);
    
    // Calcular puntuación
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalQuestions = exam?.questions.length || 0;
    
    setScore({
      correct: correctAnswers,
      total: totalQuestions
    });

    // Aquí podrías guardar las respuestas del estudiante en Firestore
    try {
      await addDoc(collection(db, 'examAttempts'), {
        examId,
        studentInfo: {
          // Aquí iría la información del estudiante
        },
        responses,
        score: {
          correct: correctAnswers,
          total: totalQuestions,
          percentage: Math.round((correctAnswers / totalQuestions) * 100)
        },
        submittedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error al guardar las respuestas:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-sky-600 animate-spin" />
          <p className="mt-4 text-lg font-medium text-gray-900">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-gray-900">Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
          <p className="mt-4 text-lg font-medium text-gray-900">No se encontró el examen</p>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {exam.title}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {exam.description}
          </p>
          <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="mb-6 p-4 bg-blue-50 rounded-md">
              <h3 className="text-lg font-medium text-blue-800">Instrucciones:</h3>
              <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Proporciona tu información personal para comenzar el examen</li>
                <li>Tendrás {exam.timeLimit} minutos para completar el examen</li>
                <li>No se puede volver a la pregunta anterior</li>
                <li>El examen se enviará automáticamente al terminar el tiempo</li>
              </ul>
            </div>
            <StudentInfoForm 
              onSubmit={handleStartExam} 
              loading={loading} 
            />
          </div>
        </div>
      </div>
    );
  }

  if (examSubmitted && score) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              ¡Examen Completado!
            </h2>
            <p className="mt-2 text-gray-600">
              Has respondido correctamente {score.correct} de {score.total} preguntas.
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex) / exam.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de progreso */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-sky-600 transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="py-4 flex justify-between items-center">
            <div className="text-sm font-medium text-gray-500">
              Pregunta {currentQuestionIndex + 1} de {exam.questions.length}
            </div>
            <div className="text-sm font-medium text-gray-900 bg-yellow-100 px-3 py-1 rounded-full">
              ⏱️ Tiempo restante: {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* Pregunta actual */}
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">
              {currentQuestion.question}
            </h3>
            
            <div className="mt-6 space-y-4">
              {currentQuestion.options.map((option, index) => (
                <div 
                  key={index}
                  onClick={() => setSelectedOption(index)}
                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
                    selectedOption === index 
                      ? 'border-sky-500 bg-sky-50' 
                      : 'border-gray-300 hover:border-sky-300 hover:bg-sky-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-5 w-5 rounded-full border flex items-center justify-center ${
                      selectedOption === index 
                        ? 'border-sky-500 bg-sky-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedOption === index && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="ml-3 text-gray-700">{option}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={selectedOption === null}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  selectedOption === null 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500'
                }`}
              >
                {currentQuestionIndex < exam.questions.length - 1 ? 'Siguiente' : 'Finalizar Examen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeExamScreen;
