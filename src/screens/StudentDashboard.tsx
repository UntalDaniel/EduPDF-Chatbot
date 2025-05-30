import React, { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { getAssignedExamsByGroup } from '../firebase/firestoreService';
import { LogOut, UserCircle, FileText, Calendar, Clock } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

interface AssignedExam {
  id: string;
  examId: string;
  groupId: string;
  teacherId: string;
  startDate?: Date;
  endDate?: Date;
  examDetails?: {
    titulo?: string;
    nombreArchivoOriginal?: string;
  };
}

const StudentDashboard: React.FC = () => {
  const [assignedExam, setAssignedExam] = useState<AssignedExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth?.currentUser;
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();

  useEffect(() => {
    if (!user || !groupId) return;
    setLoading(true);
    setError(null);
    
    const fetchExam = async () => {
      try {
        const assignments = await getAssignedExamsByGroup(groupId);
        if (assignments.length > 0) {
          const exam = assignments[0]; // Tomamos el primer examen asignado
          setAssignedExam({
            ...exam,
            id: exam.id ? String(exam.id) : '',
            startDate: (exam.startDate && typeof exam.startDate === 'object' && 'seconds' in exam.startDate)
              ? new Date((exam.startDate as any).seconds * 1000)
              : undefined,
            endDate: (exam.endDate && typeof exam.endDate === 'object' && 'seconds' in exam.endDate)
              ? new Date((exam.endDate as any).seconds * 1000)
              : undefined,
          });
        }
      } catch (err) {
        setError('Error al cargar el examen asignado.');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [user, groupId]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
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

  if (!user) {
    return <Navigate to="/student" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <header className="mb-8 md:mb-12">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center py-4 gap-4 border-b border-slate-700">
          <div className="flex items-center">
            <FileText className="h-10 w-10 text-sky-500 mr-3" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-sky-400">
              Portal del Estudiante
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-700/50 px-3 py-1.5 rounded-lg">
              <UserCircle className="h-6 w-6 text-slate-400" />
              <span className="text-sm text-slate-300 truncate max-w-[120px] sm:max-w-xs" title={user.displayName || user.email || 'Estudiante'}>
                {user.displayName || user.email?.split('@')[0] || 'Estudiante'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center text-sm"
            >
              <LogOut size={16} className="mr-1.5"/> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl">
        <div className="bg-slate-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-sky-400 mb-6">Examen Asignado</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto mb-4"></div>
              Cargando examen...
            </div>
          ) : assignedExam ? (
            <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-sky-300">
                    {assignedExam.examDetails?.titulo || assignedExam.examDetails?.nombreArchivoOriginal || 'Examen sin título'}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-300">
                    <p><Calendar className="inline-block mr-2" /> Inicio: {formatDate(assignedExam.startDate)}</p>
                    <p><Clock className="inline-block mr-2" /> Fin: {formatDate(assignedExam.endDate)}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/student/exam/${assignedExam.id}`)}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Comenzar Examen
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <FileText className="mx-auto mb-4" size={32} />
              <p>No se encontró el examen asignado.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard; 