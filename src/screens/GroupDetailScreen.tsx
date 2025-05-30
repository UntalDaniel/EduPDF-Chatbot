import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where, deleteDoc, Timestamp } from 'firebase/firestore';
import { getAssignedExamsByGroup } from '../firebase/firestoreService';
import { Loader2, Users, FileText, Download, Edit3, Trash2, CheckCircle2, XCircle, ArrowLeft, Calendar } from 'lucide-react';
import DashboardNavbar from '../components/DashboardNavbar';
import { AlertTriangle } from 'lucide-react';

interface Student {
  id: string;
  nombre: string;
}

interface ExamAttempt {
  studentId: string;
  examId: string;
  score: number;
  total: number;
}

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

const GroupDetailScreen: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, string | number>>>({});
  const user = auth.currentUser;

  // Función para obtener los intentos de examen de un estudiante
  const getStudentExamAttempts = async (studentId: string, examId: string): Promise<ExamAttempt | null> => {
    if (!db) return null;
    try {
      const attemptsRef = collection(db, `usuarios/${studentId}/examAttempts`);
      const q = query(attemptsRef, where('examId', '==', examId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      const attempt = snapshot.docs[0].data();
      return {
        studentId,
        examId,
        score: attempt.score || 0,
        total: attempt.total || 0
      };
    } catch (error) {
      console.error(`Error al obtener intentos para estudiante ${studentId} y examen ${examId}:`, error);
      return null;
    }
  };

  // Función para obtener la información del estudiante
  const getStudentInfo = async (studentId: string): Promise<Student> => {
    if (!db) return { id: studentId, nombre: `Estudiante ${studentId}` };
    try {
      const studentDoc = await getDoc(doc(db, 'usuarios', studentId));
      const studentData = studentDoc.data();
      return {
        id: studentId,
        nombre: studentData?.displayName || studentData?.email || `Estudiante ${studentId}`
      };
    } catch (error) {
      console.error(`Error al obtener información del estudiante ${studentId}:`, error);
      return {
        id: studentId,
        nombre: `Estudiante ${studentId}`
      };
    }
  };

  // Función para cargar todos los estudiantes y sus calificaciones
  const loadStudentsAndGrades = async (exams: any[]) => {
    if (!db) {
      setError('Error de conexión con la base de datos');
      return;
    }
    try {
      const studentsMap = new Map<string, Student>();
      const gradesMap: Record<string, Record<string, string | number>> = {};

      // Obtener todos los intentos de examen para este grupo
      const attemptsRef = collection(db, 'usuarios');
      const attemptsSnapshot = await getDocs(attemptsRef);

      for (const studentDoc of attemptsSnapshot.docs) {
        const studentId = studentDoc.id;
        const studentAttemptsRef = collection(db, `usuarios/${studentId}/examAttempts`);
        const studentAttemptsQuery = query(studentAttemptsRef, where('groupId', '==', groupId));
        const studentAttempts = await getDocs(studentAttemptsQuery);

        if (!studentAttempts.empty) {
          // Si el estudiante tiene intentos en este grupo, obtener su información
          const studentInfo = await getStudentInfo(studentId);
          studentsMap.set(studentId, studentInfo);
          gradesMap[studentId] = {};

          // Para cada examen asignado, buscar el intento correspondiente
          for (const exam of exams) {
            // Buscar por examAssignmentId (id del assignment)
            const attemptSnap = await getDoc(doc(db, `usuarios/${studentId}/examAttempts/${exam.id}`));
            if (attemptSnap.exists()) {
              const attempt = attemptSnap.data();
              // Solo mostrar nota si está validado
              if (attempt.status === 'validado') {
                gradesMap[studentId][exam.id] = attempt.total > 0 
                  ? ((attempt.score / attempt.total) * 5).toFixed(1)
                  : 'Pendiente';
              } else {
                gradesMap[studentId][exam.id] = 'Pendiente';
              }
            } else {
              gradesMap[studentId][exam.id] = 'Pendiente';
            }
          }
        }
      }

      setStudents(Array.from(studentsMap.values()));
      setGrades(gradesMap);
    } catch (error) {
      console.error('Error al cargar estudiantes y calificaciones:', error);
      setError('Error al cargar los datos de los estudiantes');
    }
  };

  useEffect(() => {
    if (!user || !groupId) return;
    loadGroupData();
  }, [user, groupId]);

  const loadGroupData = async () => {
    if (!user || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      // Obtener datos del grupo
      const groupRef = doc(db, `usuarios/${user.uid}/groups/${groupId}`);
      const groupDoc = await getDoc(groupRef);
      if (!groupDoc.exists()) {
        throw new Error('Grupo no encontrado');
      }
      setGroup({ id: groupDoc.id, ...groupDoc.data() });

      // Obtener exámenes asignados
      const assignments = await getAssignedExamsByGroup(groupId);
      const examsWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          const examRef = doc(db, 'exams', assignment.examId);
          const examDoc = await getDoc(examRef);
          const examDetails = examDoc.exists() ? examDoc.data() : null;
          
          const startDate = assignment.startDate instanceof Timestamp 
            ? new Date(assignment.startDate.seconds * 1000)
            : undefined;
            
          const endDate = assignment.endDate instanceof Timestamp
            ? new Date(assignment.endDate.seconds * 1000)
            : undefined;

          return {
            id: assignment.id,
            examId: assignment.examId,
            groupId: assignment.groupId,
            teacherId: assignment.teacherId,
            startDate,
            endDate,
            examDetails: examDetails || undefined
          } as AssignedExam;
        })
      );
      setAssignedExams(examsWithDetails);

      // Cargar estudiantes y calificaciones
      await loadStudentsAndGrades(examsWithDetails);
    } catch (err: any) {
      setError('Error al cargar los datos: ' + (err.message || 'Error desconocido'));
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
      await loadGroupData();
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

  const handleExportCSV = () => {
    if (!students.length || !assignedExams.length) return;
    // Usar títulos reales de los exámenes
    const headers = ['Estudiante', ...assignedExams.map(e => e.examDetails?.titulo || e.examDetails?.nombreArchivoOriginal || e.examId)];
    const rows = students.map(stu => [
      stu.nombre,
      ...assignedExams.map(exam => grades[stu.id]?.[exam.id] ?? 'Pendiente')
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas_grupo_${groupId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && !group) {
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
              onClick={() => navigate('/dashboard/groups')}
              className="text-sky-400 hover:text-sky-300"
            >
              Volver a Grupos
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
            onClick={() => navigate('/dashboard/groups')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Grupos
          </button>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <Users className="w-6 h-6" /> {group?.name}
          </h1>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-sky-300 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Exámenes Asignados
          </h2>
          {assignedExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedExams.map(exam => (
                <div key={exam.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-sky-200">
                      {exam.examDetails?.titulo || exam.examDetails?.nombreArchivoOriginal || 'Examen sin título'}
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

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-semibold text-sky-300 text-lg">Notas del grupo</span>
            <button
              onClick={handleExportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
              disabled={!students.length || !assignedExams.length}
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[400px] bg-slate-800 rounded-lg">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-sky-300">Estudiante</th>
                  {assignedExams.map(exam => (
                    <th key={exam.examId} className="px-4 py-2 text-sky-300">{exam.examDetails?.titulo || exam.examDetails?.nombreArchivoOriginal || exam.examId}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(stu => (
                  <tr key={stu.id} className="border-t border-slate-700">
                    <td className="px-4 py-2 font-semibold text-slate-200">{stu.nombre}</td>
                    {assignedExams.map(exam => (
                      <td key={exam.id} className="px-4 py-2 text-slate-100">
                        {grades[stu.id]?.[exam.id] === 'Pendiente' ? (
                          <span className="flex items-center gap-1 text-yellow-300 font-medium"><XCircle size={16}/> Pendiente</span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-400 font-semibold"><CheckCircle2 size={16}/> {grades[stu.id][exam.id]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailScreen; 