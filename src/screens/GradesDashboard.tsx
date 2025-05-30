import React, { useEffect, useState } from 'react';
import { getGroupsByTeacher, getAssignedExamsByGroup } from '../firebase/firestoreService';
import { db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';
import { Loader2, Users, FileText, Eye, CheckCircle2, Trash2 } from 'lucide-react';

const GradesDashboard: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [manualGrades, setManualGrades] = useState<{ [qId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error de autenticación</h1>
        <p className="text-lg mb-2">No se pudo inicializar el sistema de autenticación.</p>
        <p className="text-md">Por favor, recarga la página o contacta al soporte.</p>
      </div>
    );
  }
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    getGroupsByTeacher(user.uid).then(setGroups);
  }, [user]);

  useEffect(() => {
    if (!selectedGroup) return;
    setExams([]);
    setSelectedExam('');
    getAssignedExamsByGroup(selectedGroup).then(setExams);
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedExam || !selectedGroup) return;
    if (!db) return;
    setLoading(true);
    const fetchAttempts = async () => {
      if (!db) return;
      const q = query(collection(db, `usuarios`), where('role', '==', 'alumno'));
      const studentsSnap = await getDocs(q);
      const attemptsArr: any[] = [];
      for (const studentDoc of studentsSnap.docs) {
        const studentId = studentDoc.id;
        if (!db) continue;
        const attemptSnap = await getDocs(collection(db, `usuarios/${studentId}/examAttempts`));
        attemptSnap.forEach((docSnap) => {
          if (docSnap.id === selectedExam) {
            attemptsArr.push({ ...docSnap.data(), id: docSnap.id, studentId });
          }
        });
      }
      setAttempts(attemptsArr);
      setLoading(false);
    };
    fetchAttempts();
  }, [selectedExam, selectedGroup, db]);

  const handleOpenAttempt = (attempt: any) => {
    setSelectedAttempt(attempt);
    setManualGrades({});
  };

  const handleManualGradeChange = (qId: string, value: string) => {
    setManualGrades((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSaveManualGrades = async () => {
    if (!selectedAttempt) return;
    if (!db) return;
    setSaving(true);
    try {
      const attemptRef = doc(db, `usuarios/${selectedAttempt.studentId}/examAttempts/${selectedAttempt.id}`);
      const newFeedback = selectedAttempt.feedback.map((f: any) =>
        f.tipo === 'abierta'
          ? { ...f, calificacionManual: manualGrades[f.id] || f.calificacionManual || '' }
          : f
      );
      await updateDoc(attemptRef, { feedback: newFeedback });
      setSelectedAttempt({ ...selectedAttempt, feedback: newFeedback });
    } catch (err) {
      alert('Error al guardar la calificación manual');
    } finally {
      setSaving(false);
    }
  };

  const handleImportCsv = async () => {
    if (!importFile || !selectedExam || !selectedGroup) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('exam_id', selectedExam);
      formData.append('group_id', selectedGroup);
      const response = await fetch('/api/v1/exam-responses/import-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setImportResult(`Importación exitosa: ${data.imported} respuestas importadas.`);
      } else {
        setImportResult(`Error: ${data.detail || 'No se pudo importar el archivo.'}`);
      }
    } catch (err) {
      setImportResult('Error al importar el archivo CSV.');
    } finally {
      setImporting(false);
      setShowImportModal(false);
      setImportFile(null);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este examen?')) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'exams', examId));
      setExams(exams.filter(exam => exam.id !== examId));
      setSelectedExam('');
    } catch (error) {
      alert('Error al eliminar el examen.');
    }
  };

  if (!db) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error de conexión</h1>
        <p className="text-lg mb-2">No se pudo conectar con la base de datos.</p>
        <p className="text-md">Por favor, recarga la página o contacta al soporte.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <h1 className="text-3xl font-bold text-sky-400 mb-8 flex items-center gap-2"><Users /> Calificaciones de Exámenes</h1>
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div>
          <label className="block mb-1 text-slate-300 font-medium">Grupo</label>
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-3 py-2">
            <option value="">Selecciona un grupo</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-slate-300 font-medium">Examen</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-3 py-2">
            <option value="">Selecciona un examen</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.examId}</option>)}
          </select>
        </div>
      </div>
      {selectedExam && (
        <div className="mb-4 flex items-center gap-4">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
            onClick={() => setShowImportModal(true)}
          >
            <FileText size={16} /> Importar respuestas CSV
          </button>
          <button
            onClick={() => handleDeleteExam(selectedExam)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
          >
            <Trash2 size={16} /> Eliminar Examen
          </button>
          {importResult && <div className="mt-2 text-sm text-sky-300">{importResult}</div>}
        </div>
      )}
      {loading ? (
        <div className="text-center py-8 text-slate-400">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-sky-500" />
          Cargando intentos...
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map(attempt => (
            <div key={attempt.studentId} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sky-300">Estudiante: {attempt.studentId}</div>
                <div className="text-slate-300 text-sm">Puntaje automático: {attempt.score} / {attempt.total}</div>
              </div>
              <button onClick={() => handleOpenAttempt(attempt)} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2">
                <Eye size={16}/> Ver Detalle
              </button>
            </div>
          ))}
        </div>
      )}
      {selectedAttempt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAttempt(null)}>
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-auto animate-modalEnter" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-sky-300 mb-4">Detalle del Intento</h2>
            <div className="mb-4">
              <div className="font-semibold text-slate-200">Estudiante: {selectedAttempt.studentId}</div>
              <div className="text-slate-300 text-sm">Puntaje automático: {selectedAttempt.score} / {selectedAttempt.total}</div>
            </div>
            <div className="space-y-3 mb-4">
              {selectedAttempt.feedback.map((f: any, i: number) => (
                <div key={f.id} className="bg-slate-700/60 p-3 rounded-lg">
                  <div className="font-semibold text-sky-200">{i + 1}. {f.enunciado}</div>
                  <div className="text-slate-300 text-sm">Respuesta estudiante: <span className="font-mono">{f.respuestaEstudiante ?? 'Sin respuesta'}</span></div>
                  {f.tipo !== 'abierta' ? (
                    <div className={f.correcto === true ? 'text-green-400' : 'text-red-400'}>
                      {f.correcto === true ? '✔️ Correcta' : '❌ Incorrecta'}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <label className="block text-slate-300 mb-1">Calificación manual:</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-200"
                        value={manualGrades[f.id] ?? f.calificacionManual ?? ''}
                        onChange={e => handleManualGradeChange(f.id, e.target.value)}
                        placeholder="Pendiente de calificar"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveManualGrades}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 mt-2"
            >
              {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="mr-2"/> Guardar Calificaciones Manuales</>}
            </button>
            <button
              onClick={() => setSelectedAttempt(null)}
              className="w-full mt-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-sky-300">Importar respuestas CSV</h2>
            <input
              type="file"
              accept=".csv"
              onChange={e => setImportFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-slate-600 rounded-md mb-4 bg-slate-700 text-slate-200"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-slate-600 rounded hover:bg-slate-700 text-slate-200">Cancelar</button>
              <button
                onClick={handleImportCsv}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={!importFile || importing}
              >
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradesDashboard; 