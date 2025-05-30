import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit3, Download, Send, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';

const MySavedExamsScreen: React.FC = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!db || !auth || !auth.currentUser) {
      setConnectionError(true);
      return;
    }
    setLoading(true);
    const fetchExams = async () => {
      const q = query(
        collection(db, 'exams'),
        where('author_id', '==', auth.currentUser!.uid),
        where('is_assigned', '==', false),
        where('is_google_form', '==', false)
      );
      const snapshot = await getDocs(q);
      const examsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(examsList);
      setLoading(false);
    };
    fetchExams();
  }, []);

  const handleEdit = (examId: string) => {
    navigate(`/dashboard/create-exam/${examId}`);
  };

  const handleDownload = (exam: any) => {
    const doc = new jsPDF();
    doc.text(exam.title || 'Examen', 10, 10);
    let y = 20;
    exam.questions.forEach((q: any, i: number) => {
      doc.text(`${i + 1}. ${q.text || q.enunciado}`, 10, y);
      y += 10;
    });
    doc.save(`${exam.title || 'examen'}.pdf`);
  };

  const handleShare = (examId: string) => {
    navigate(`/dashboard/assign-exam?examId=${examId}`);
  };

  const handleDeleteExam = async (examId: string) => {
    setDeleteError(null);
    if (!db) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar este examen? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'exams', examId));
      setExams(exams.filter(exam => exam.id !== examId));
    } catch (error: any) {
      setDeleteError('Error al eliminar el examen: ' + (error?.message || 'Error desconocido.'));
    }
  };

  if (connectionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error de conexión</h1>
        <p className="text-lg mb-2">No se pudo conectar con la base de datos.</p>
        <p className="text-md">Por favor, recarga la página o contacta al soporte.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sky-400 hover:text-sky-200 font-semibold text-lg transition-colors group">
          <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" /> Volver
        </button>
        <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-2 mb-8"><FileText size={32}/> Mis Exámenes Guardados</h1>
        {deleteError && (
          <div className="mb-4 p-3 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg">{deleteError}</div>
        )}
        <div className="space-y-6">
          {exams.map(exam => (
            <div key={exam.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
              <div>
                <div className="text-lg md:text-xl font-bold text-sky-200 mb-1">Examen para "{exam.title}"</div>
                <div className="text-slate-300 text-sm">Preguntas: {exam.questions?.length || 0}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200"
                  onClick={() => handleEdit(exam.id)}
                ><Edit3 size={18}/> Editar</button>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200"
                  onClick={() => handleDownload(exam)}
                ><Download size={18}/> Descargar</button>
                <button
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200"
                  onClick={() => handleShare(exam.id)}
                ><Send size={18}/> Compartir</button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200"
                  onClick={() => handleDeleteExam(exam.id)}
                ><Trash2 size={18}/> Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MySavedExamsScreen; 