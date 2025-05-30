import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth as firebaseAuth } from '../firebase/firebaseConfig';
import { LogOut, Loader2, FileText, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { getExamQuestionsByAssignment, saveStudentExamAttempt } from '../firebase/firestoreService';
import Confetti from 'react-confetti';

// Tipos para preguntas
interface ExamQuestion {
  id: string;
  tipo: 'vf' | 'opcion_multiple' | 'abierta' | 'completar';
  enunciado: string;
  opciones?: string[];
}

const StudentExamScreen: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const navigate = useNavigate();
  const [assignmentInfo, setAssignmentInfo] = useState<{ examId: string; groupId: string } | null>(null);
  const [result, setResult] = useState<{ score: number; total: number; feedback: any[] } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const user = firebaseAuth?.currentUser;
    if (!user) return;
    if (!assignmentId) {
      setError('No se encontró el examen asignado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getExamQuestionsByAssignment(assignmentId)
      .then((preguntas: any) => {
        setQuestions(preguntas);
        // Extraer examId y groupId del assignment
        if (preguntas && preguntas.length > 0 && preguntas[0].examId && preguntas[0].groupId) {
          setAssignmentInfo({ examId: preguntas[0].examId, groupId: preguntas[0].groupId });
        } else {
          // Si no viene, hacer una consulta extra (opcional)
          setAssignmentInfo(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error al cargar las preguntas del examen.');
        setLoading(false);
      });
  }, [assignmentId]);

  const user = firebaseAuth?.currentUser;
  if (!user) {
    navigate('/student', { replace: true });
    return null;
  }

  const handleChange = (qId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setResult(null);
    setShowConfetti(false);
    try {
      if (!assignmentId || !assignmentInfo) throw new Error('Faltan datos de la asignación.');
      const res = await saveStudentExamAttempt(user.uid, assignmentId, answers, assignmentInfo);
      setSuccess('¡Respuestas enviadas correctamente!');
      setResult(res);
      if (res.score / (res.total || 1) >= 0.7) setShowConfetti(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar las respuestas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <header className="mb-8 md:mb-12">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center py-4 gap-4 border-b border-slate-700">
          <div className="flex items-center">
            <FileText className="h-10 w-10 text-sky-500 mr-3" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-sky-400">
              Resolución de Examen
            </h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-medium py-2 px-4 rounded-lg flex items-center text-sm"
          >
            <ArrowLeft size={16} className="mr-1.5"/> Volver
          </button>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl">
        <div className="bg-slate-800 rounded-xl shadow-lg p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-sky-500" />
              Cargando preguntas del examen...
            </div>
          ) : error ? (
            <div className="mb-6 p-4 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center">
              <AlertCircle className="mr-2 shrink-0" />
              {error}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="mx-auto mb-4" size={32} />
              <p>No hay preguntas disponibles para este examen.</p>
            </div>
          ) : (
            <form className="space-y-8" onSubmit={handleSubmit}>
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                  <div className="mb-3 font-semibold text-sky-300">{idx + 1}. {q.enunciado}</div>
                  {q.tipo === 'vf' && (
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2">
                        <input type="radio" name={`q_${q.id}`} value="verdadero" className="accent-sky-500" onChange={() => handleChange(q.id, 'verdadero')} checked={answers[q.id] === 'verdadero'} /> Verdadero
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name={`q_${q.id}`} value="falso" className="accent-sky-500" onChange={() => handleChange(q.id, 'falso')} checked={answers[q.id] === 'falso'} /> Falso
                      </label>
                    </div>
                  )}
                  {q.tipo === 'opcion_multiple' && q.opciones && (
                    <div className="flex flex-col gap-2">
                      {q.opciones.map((op, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input type="radio" name={`q_${q.id}`} value={op} className="accent-sky-500" onChange={() => handleChange(q.id, op)} checked={answers[q.id] === op} /> {op}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.tipo === 'abierta' && (
                    <textarea
                      name={`q_${q.id}`}
                      className="w-full mt-2 px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      rows={3}
                      placeholder="Escribe tu respuesta aquí..."
                      value={answers[q.id] || ''}
                      onChange={e => handleChange(q.id, e.target.value)}
                    />
                  )}
                  {q.tipo === 'completar' && (
                    <input
                      type="text"
                      name={`q_${q.id}`}
                      className="w-full mt-2 px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Completa la frase"
                      value={answers[q.id] || ''}
                      onChange={e => handleChange(q.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Enviar Respuestas'}
              </button>
              {success && result && (
                <div className="mt-6 p-4 bg-slate-800/80 text-green-200 border border-green-600/50 rounded-xl flex flex-col items-center gap-3 relative overflow-hidden">
                  {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={200} recycle={false} />}
                  <div className="flex flex-col items-center mb-2">
                    <CheckCircle2 className="text-green-400" size={48} />
                    <span className="text-xl font-bold mt-2">¡Examen enviado!</span>
                  </div>
                  <div className="font-semibold text-lg text-green-100">Puntaje: {result.score} / {result.total} ({((result.score / (result.total || 1)) * 100).toFixed(0)}%)</div>
                  <div className="text-base font-medium mt-1 mb-2">
                    {result.score / (result.total || 1) >= 0.7
                      ? '¡Felicidades, buen trabajo!'
                      : result.score === 0
                      ? '¡Ánimo! Puedes mejorar en el próximo intento.'
                      : '¡Sigue practicando, vas por buen camino!'}
                  </div>
                  <div className="mt-2 w-full">
                    <h4 className="font-semibold text-green-100 mb-1">Detalle de tus respuestas:</h4>
                    <ul className="space-y-2">
                      {result.feedback.map((f, i) => (
                        <li key={f.id} className={
                          f.correcto === true ? 'bg-green-700/30 border border-green-600/40 rounded p-2' :
                          f.correcto === false ? 'bg-red-700/30 border border-red-600/40 rounded p-2' :
                          'bg-yellow-700/20 border border-yellow-600/30 rounded p-2'
                        }>
                          <div className="font-semibold text-sky-200">{i + 1}. {f.enunciado}</div>
                          <div className="text-sm mt-1">
                            <span className="font-medium">Tu respuesta: </span>{String(f.respuestaEstudiante) || <span className="italic text-slate-400">Sin respuesta</span>}
                          </div>
                          {f.respuestaCorrecta !== undefined && (
                            <div className="text-sm mt-1">
                              <span className="font-medium">Respuesta correcta: </span>{String(f.respuestaCorrecta)}
                            </div>
                          )}
                          {f.correcto === true && <div className="text-green-400 font-semibold mt-1 flex items-center gap-1"><CheckCircle2 size={16}/> ¡Correcto!</div>}
                          {f.correcto === false && <div className="text-red-400 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={16}/> Incorrecto</div>}
                          {f.correcto === null && <div className="text-yellow-300 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={16}/> Pendiente de revisión manual</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className="mt-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors text-base"
                    onClick={() => navigate('/student/dashboard')}
                  >
                    Volver al Panel de Exámenes
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentExamScreen; 