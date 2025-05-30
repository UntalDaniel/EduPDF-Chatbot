import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { FileText, Calendar, Trash2, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface AssignedExam {
  id: string;
  examId: string;
  groupId: string;
  teacherId: string;
  startDate?: Date;
  endDate?: Date;
  examDetails?: {
    title?: string;
    pdf_id?: string;
  };
}

const AssignedExamsView: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user || !groupId) return;
    loadAssignedExams();
  }, [user, groupId]);

  const loadAssignedExams = async () => {
    if (!user || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      // Obtener exámenes asignados
      const assignmentsRef = collection(db, 'exams_assigned');
      const assignmentsQuery = query(
        assignmentsRef,
        where('groupId', '==', groupId),
        where('teacherId', '==', user.uid)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);
      
      // Obtener detalles de los exámenes
      const examsWithDetails = await Promise.all(
        assignmentsSnap.docs.map(async (docSnapshot) => {
          const assignment = docSnapshot.data();
          const examRef = doc(db, 'exams', assignment.examId);
          const examDoc = await getDoc(examRef);
          const examDetails = examDoc.exists() ? examDoc.data() : null;
          
          return {
            id: docSnapshot.id,
            examId: assignment.examId,
            groupId: assignment.groupId,
            teacherId: assignment.teacherId,
            startDate: assignment.startDate?.toDate(),
            endDate: assignment.endDate?.toDate(),
            examDetails: examDetails || undefined
          } as AssignedExam;
        })
      );
      
      setAssignedExams(examsWithDetails);
    } catch (err: any) {
      setError('Error al cargar los exámenes asignados: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignExam = async (assignmentId: string) => {
    if (!user || !window.confirm('¿Estás seguro de que quieres desasignar este examen?')) return;
    setLoading(true);
    setError(null);
    try {
      const assignmentRef = doc(db, 'exams_assigned', assignmentId);
      await deleteDoc(assignmentRef);
      await loadAssignedExams();
    } catch (err: any) {
      setError('Error al desasignar el examen: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'No especificada';
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !assignedExams.length) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-semibold text-red-400 mb-2">{error}</h2>
            <button
              onClick={loadAssignedExams}
              className="text-sky-400 hover:text-sky-300"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/dashboard/groups/${groupId}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Grupo
          </button>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Exámenes Asignados
          </h1>
        </div>

        {assignedExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedExams.map(exam => (
              <div key={exam.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-sky-200">
                    {exam.examDetails?.title || 'Examen sin título'}
                  </h3>
                  <button
                    onClick={() => handleUnassignExam(exam.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Desasignar examen"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Inicio: {formatDate(exam.startDate)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Fin: {formatDate(exam.endDate)}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/groups/${groupId}/exam/${exam.id}`)}
                  className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-5 h-5" /> Ver Detalles
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl">
            <FileText className="mx-auto h-16 w-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              No hay exámenes asignados
            </h3>
            <p className="text-slate-500">
              Asigna exámenes a este grupo desde la sección de exámenes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedExamsView; 