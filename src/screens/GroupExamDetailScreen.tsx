import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Loader2, Users, FileText, ArrowLeft, Eye } from 'lucide-react';

interface StudentAttempt {
  studentId: string;
  nombre: string;
  score: number;
  total: number;
  estado: string; // 'pendiente' o 'validado'
}

const GroupExamDetailScreen: React.FC = () => {
  const { groupId, examAssignmentId } = useParams<{ groupId: string; examAssignmentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string>('');
  const [studentAttempts, setStudentAttempts] = useState<StudentAttempt[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !groupId || !examAssignmentId) {
        setError('Faltan datos para cargar el examen.');
        setLoading(false);
        return;
      }
      try {
        // 1. Obtener datos del examen asignado
        const assignmentDoc = await getDoc(doc(db, 'exams_assigned', examAssignmentId));
        if (!assignmentDoc.exists()) throw new Error('No se encontró la asignación de examen.');
        const assignmentData = assignmentDoc.data();
        setExamTitle(assignmentData.titulo || assignmentData.examId || 'Examen');
        const examId = assignmentData.examId;

        // 2. Buscar todos los usuarios
        const usersSnap = await getDocs(collection(db, 'usuarios'));
        const attempts: StudentAttempt[] = [];
        for (const userDoc of usersSnap.docs) {
          const studentId = userDoc.id;
          // 3. Buscar intento de este estudiante para este assignment
          const attemptsRef = collection(db, `usuarios/${studentId}/examAttempts`);
          const q = query(attemptsRef, where('examId', '==', examId), where('groupId', '==', groupId));
          const attemptSnap = await getDocs(q);
          if (!attemptSnap.empty) {
            const attemptData = attemptSnap.docs[0].data();
            attempts.push({
              studentId,
              nombre: userDoc.data().displayName || userDoc.data().email || `Estudiante ${studentId}`,
              score: attemptData.score || 0,
              total: attemptData.total || 0,
              estado: attemptData.status === 'validado' ? 'validado' : 'pendiente',
            });
          }
        }
        setStudentAttempts(attempts);
      } catch (err: any) {
        setError(err.message || 'Error al cargar los datos.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, groupId, examAssignmentId]);

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
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sky-400 hover:text-sky-200 font-semibold text-lg transition-colors group">
          <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" /> Volver
        </button>
        <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-2 mb-8"><FileText size={32}/> Detalle del Examen</h1>
        <div className="mb-6">
          <div className="text-lg font-semibold text-slate-200">ID de grupo: <span className="text-sky-300">{groupId}</span></div>
          <div className="text-lg font-semibold text-slate-200">ID de asignación de examen: <span className="text-sky-300">{examAssignmentId}</span></div>
        </div>
        <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 text-slate-300 backdrop-blur-md">
          <h2 className="text-xl font-bold text-sky-300 mb-4 flex items-center gap-2"><Users /> Respuestas de los estudiantes</h2>
          {studentAttempts.length === 0 ? (
            <p className="text-center text-slate-400">Ningún estudiante ha respondido este examen aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[400px] bg-slate-900 rounded-lg">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-sky-300">Estudiante</th>
                    <th className="px-4 py-2 text-sky-300">Nota (0-5.0)</th>
                    <th className="px-4 py-2 text-sky-300">Estado</th>
                    <th className="px-4 py-2 text-sky-300">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAttempts.map(stu => (
                    <tr key={stu.studentId} className="border-t border-slate-700">
                      <td className="px-4 py-2 font-semibold text-slate-200">{stu.nombre}</td>
                      <td className="px-4 py-2 text-slate-100">{stu.total > 0 ? (stu.score / stu.total * 5).toFixed(1) : 'Pendiente'}</td>
                      <td className="px-4 py-2 text-slate-100">{stu.estado === 'validado' ? <span className="text-green-400 font-semibold">Validado</span> : <span className="text-yellow-300 font-semibold">Pendiente</span>}</td>
                      <td className="px-4 py-2 text-slate-100">
                        <button
                          className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded flex items-center gap-1 text-sm font-medium"
                          onClick={() => navigate(`/dashboard/groups/${groupId}/exam/${examAssignmentId}/student/${stu.studentId}`)}
                        >
                          <Eye size={16}/> Ver intento
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupExamDetailScreen; 