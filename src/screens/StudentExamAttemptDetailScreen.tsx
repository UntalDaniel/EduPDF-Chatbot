import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, User, FileText, CheckCircle2, XCircle } from 'lucide-react';
import DashboardNavbar from '../components/DashboardNavbar';

interface FeedbackItem {
  id: string;
  tipo: string;
  enunciado: string;
  respuestaEstudiante: any;
  respuestaCorrecta?: any;
  correcto?: boolean | null;
}

const StudentExamAttemptDetailScreen: React.FC = () => {
  const { groupId, examAssignmentId, studentId } = useParams<{ groupId: string; examAssignmentId: string; studentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [manualFeedback, setManualFeedback] = useState<FeedbackItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [score, setScore] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !studentId || !examAssignmentId) {
        setError('Faltan datos para cargar el intento.');
        setLoading(false);
        return;
      }
      try {
        // Buscar el intento del estudiante para este assignment
        const attemptRef = doc(db, `usuarios/${studentId}/examAttempts/${examAssignmentId}`);
        const attemptSnap = await getDoc(attemptRef);
        if (!attemptSnap.exists()) throw new Error('No se encontró el intento de este estudiante.');
        const attemptData = attemptSnap.data();
        setAttempt(attemptData);
        setFeedback(attemptData.feedback || []);
        setManualFeedback(attemptData.feedback ? JSON.parse(JSON.stringify(attemptData.feedback)) : []);
        setScore(attemptData.score || 0);
        setTotal(attemptData.total || 0);
        setHasChanges(false);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el intento.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, studentId, examAssignmentId]);

  // Función para actualizar la corrección manual de una pregunta
  const handleManualReview = (idx: number, value: boolean) => {
    setManualFeedback(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], correcto: value };
      return updated;
    });
    setHasChanges(true);
  };

  // Función para guardar la revisión manual
  const handleSaveManualReview = async () => {
    if (!db || !studentId || !examAssignmentId) return;
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      // Recalcular score y total
      let newScore = 0;
      let newTotal = 0;
      manualFeedback.forEach(item => {
        if (item.correcto === true || item.correcto === false) {
          newTotal++;
          if (item.correcto === true) newScore++;
        }
      });
      // Actualizar Firestore
      await updateDoc(doc(db, `usuarios/${studentId}/examAttempts/${examAssignmentId}`), {
        feedback: manualFeedback,
        score: newScore,
        total: newTotal,
        status: 'validado',
        validatedAt: serverTimestamp(),
      });
      setScore(newScore);
      setTotal(newTotal);
      setHasChanges(false);
      setSaveSuccess('¡Revisión guardada y validada correctamente!');
    } catch (err: any) {
      setSaveError('Error al guardar la revisión: ' + (err.message || 'Error desconocido.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error</h1>
        <p className="text-lg mb-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <DashboardNavbar />
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sky-400 hover:text-sky-200 font-semibold text-lg transition-colors group">
          <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" /> Volver
        </button>
        <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-2 mb-8"><FileText size={32}/> Intento del Estudiante</h1>
        <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 text-slate-300 backdrop-blur-md">
          <h2 className="text-xl font-bold text-sky-300 mb-4 flex items-center gap-2"><User /> Respuestas y feedback</h2>
          {saveSuccess && <div className="mb-4 text-green-400 font-semibold">{saveSuccess}</div>}
          {saveError && <div className="mb-4 text-red-400 font-semibold">{saveError}</div>}
          {manualFeedback.length === 0 ? (
            <p className="text-center text-slate-400">No hay feedback disponible para este intento.</p>
          ) : (
            <>
              <div className="space-y-6 mb-6">
                {manualFeedback.map((item, idx) => (
                  <div key={item.id || idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <div className="font-semibold text-sky-200 mb-1">{idx + 1}. {item.enunciado}</div>
                    <div className="mb-1"><span className="font-medium text-slate-400">Respuesta del estudiante:</span> <span className="text-slate-100">{String(item.respuestaEstudiante)}</span></div>
                    {item.respuestaCorrecta !== undefined && (
                      <div className="mb-1"><span className="font-medium text-slate-400">Respuesta correcta:</span> <span className="text-green-300">{String(item.respuestaCorrecta)}</span></div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {item.correcto === true && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={18}/> Correcto</span>}
                      {item.correcto === false && <span className="text-red-400 flex items-center gap-1"><XCircle size={18}/> Incorrecto</span>}
                      {item.correcto === null && <span className="text-yellow-300">Pendiente de revisión</span>}
                      {/* Solo permitir revisión manual en abiertas y completar */}
                      {['abierta', 'completar'].includes(item.tipo) && (
                        <>
                          <button
                            className={`ml-4 px-3 py-1 rounded font-medium ${item.correcto === true ? 'bg-green-600 text-white' : 'bg-slate-700 text-green-300 border border-green-600'}`}
                            onClick={() => handleManualReview(idx, true)}
                            type="button"
                          >
                            Marcar Correcto
                          </button>
                          <button
                            className={`ml-2 px-3 py-1 rounded font-medium ${item.correcto === false ? 'bg-red-600 text-white' : 'bg-slate-700 text-red-300 border border-red-600'}`}
                            onClick={() => handleManualReview(idx, false)}
                            type="button"
                          >
                            Marcar Incorrecto
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasChanges && (
                <button
                  className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-md font-semibold flex items-center gap-2 disabled:opacity-50"
                  onClick={handleSaveManualReview}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 size={20} />}
                  Guardar revisión y validar intento
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentExamAttemptDetailScreen; 