import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { FileText, Users, Calendar, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface Exam {
  id: string;
  title: string;
  pdf_id: string;
  teacherId: string;
}

const AssignExamToGroups: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Cargar grupos
      const groupsRef = collection(db, `usuarios/${user.uid}/groups`);
      const groupsSnap = await getDocs(groupsRef);
      const groupsData = groupsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      setGroups(groupsData);

      // Cargar exámenes
      const examsRef = collection(db, 'exams');
      const examsQuery = query(examsRef, where('teacherId', '==', user.uid));
      const examsSnap = await getDocs(examsQuery);
      const examsData = examsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Exam[];
      setExams(examsData);
    } catch (err: any) {
      setError('Error al cargar los datos: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignExam = async () => {
    if (!user || !selectedExam || selectedGroups.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const assignmentsRef = collection(db, 'exams_assigned');
      const assignments = selectedGroups.map(groupId => ({
        examId: selectedExam,
        groupId,
        teacherId: user.uid,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdAt: new Date()
      }));

      await Promise.all(assignments.map(assignment => addDoc(assignmentsRef, assignment)));
      navigate('/dashboard/groups');
    } catch (err: any) {
      setError('Error al asignar el examen: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  if (loading && !groups.length && !exams.length) {
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
              onClick={loadData}
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
            onClick={() => navigate('/dashboard/groups')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Grupos
          </button>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Asignar Examen a Grupos
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Selección de Examen */}
          <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-sky-300 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Seleccionar Examen
            </h2>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Selecciona un examen</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Grupos */}
          <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-sky-300 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> Seleccionar Grupos
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {groups.map(group => (
                <label
                  key={group.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-700/50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => handleGroupSelect(group.id)}
                    className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500"
                  />
                  <span className="text-slate-300">{group.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fechas de Inicio y Fin */}
          <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl p-6 md:col-span-2">
            <h2 className="text-xl font-semibold text-sky-300 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Fechas de Disponibilidad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Fecha de Inicio (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Fecha de Fin (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleAssignExam}
            disabled={!selectedExam || selectedGroups.length === 0 || loading}
            className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <>
                <FileText className="w-5 h-5" /> Asignar Examen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignExamToGroups; 