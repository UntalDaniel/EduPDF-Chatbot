import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink, Loader2, ArrowLeft } from 'lucide-react';

const MyFormsScreen: React.FC = () => {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!db || !auth || !auth.currentUser) {
      setConnectionError(true);
      return;
    }
    setLoading(true);
    const fetchForms = async () => {
      const q = query(
        collection(db, 'exams'),
        where('author_id', '==', auth.currentUser!.uid),
        where('is_google_form', '==', true)
      );
      const snapshot = await getDocs(q);
      const formsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setForms(formsList);
      setLoading(false);
    };
    fetchForms();
  }, []);

  if (loading) {
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

  if (connectionError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-500">Error de conexión. Por favor, intenta de nuevo más tarde.</p>
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
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Dashboard
          </button>
          <h1 className="text-2xl font-bold text-sky-400">Mis Formatos de Google</h1>
        </div>

        <div className="space-y-4">
          {forms.map(form => (
            <div key={form.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
              <div>
                <div className="text-lg md:text-xl font-bold text-sky-200 mb-1">Formato: "{form.title}"</div>
                <div className="text-slate-300 text-sm">Preguntas: {form.questions?.length || 0}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={form.google_form_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200"
                >
                  <ExternalLink size={18}/> Abrir Formato
                </a>
              </div>
            </div>
          ))}

          {forms.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-16 w-16 text-slate-600 mb-4" />
              <h2 className="text-2xl font-semibold text-slate-400 mb-2">
                No hay formatos de Google
              </h2>
              <p className="text-slate-500">
                Los exámenes que compartas como Google Forms aparecerán aquí.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyFormsScreen; 