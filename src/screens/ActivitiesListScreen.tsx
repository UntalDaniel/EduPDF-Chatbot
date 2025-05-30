import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, AlertTriangle, Puzzle, Download, PlusCircle } from 'lucide-react';
import { getActivitiesByPdf, deleteActivity } from '../firebase/activityService';
import { useAuth } from '../hooks';
import { ActivityType, WordConnectionData } from '../types/activityTypes';
import type { ActivityTypeActivity } from '../types/activityTypes';
import ModalSelectPdf from '../components/ModalSelectPdf';
import { getPdfsByTeacher } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';
import html2pdf from 'html2pdf.js';

const ActivitiesListScreen: React.FC = () => {
  const { pdfId } = useParams<{ pdfId: string }>();
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityTypeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!pdfId) {
      setShowPdfModal(true);
      return;
    }
    const fetchActivities = async () => {
      try {
        const activitiesList = await getActivitiesByPdf(pdfId);
        setActivities(activitiesList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar las actividades');
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [pdfId]);

  useEffect(() => {
    const fetchPdfs = async () => {
      if (user) {
        try {
          const pdfList = await getPdfsByTeacher(user.uid);
          setUserPdfs(pdfList);
        } catch (e) {
          setUserPdfs([]);
        }
      }
    };
    if (showPdfModal) fetchPdfs();
  }, [user, showPdfModal]);

  const handleSelectPdf = (selectedPdfId: string) => {
    setShowPdfModal(false);
    navigate(`/dashboard/activities/${selectedPdfId}`);
  };

  const handleCloseModal = () => {
    setShowPdfModal(false);
    navigate('/dashboard');
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta actividad?')) {
      return;
    }

    try {
      await deleteActivity(activityId);
      setActivities(activities.filter(activity => activity.id !== activityId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la actividad');
    }
  };

  const handleDownloadPDF = async (activity: ActivityTypeActivity) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 20px;">
        <h1 style="text-align: center; margin-bottom: 20px;">${activity.title}</h1>
        <p style="margin-bottom: 20px;">${activity.description}</p>
        <div id="activity-content"></div>
      </div>
    `;
    document.body.appendChild(element);

    const activityContent = element.querySelector('#activity-content');
    if (activityContent) {
      switch (activity.type) {
        case ActivityType.WORD_SEARCH:
          const gridArr = Array.isArray(activity.data.grid) && Array.isArray(activity.data.grid[0])
            ? activity.data.grid as string[][]
            : [];
          const grid = gridArr.map(row => row.join(' ')).join('\n');
          activityContent.innerHTML = `
            <div style="font-family: monospace; white-space: pre; margin: 20px 0;">
              ${grid}
            </div>
            <div style="margin-top: 20px;">
              <h3>Palabras a encontrar:</h3>
              <ul>
                ${(activity.data.words as string[]).map(word => `<li>${word}</li>`).join('')}
              </ul>
            </div>
          `;
          break;
        case ActivityType.CROSSWORD:
          const crosswordGridArr = Array.isArray(activity.data.grid) && Array.isArray(activity.data.grid[0])
            ? activity.data.grid as string[][]
            : [];
          const crosswordGrid = crosswordGridArr.map(row => row.join(' ')).join('\n');
          activityContent.innerHTML = `
            <div style="font-family: monospace; white-space: pre; margin: 20px 0;">
              ${crosswordGrid}
            </div>
            <div style="margin-top: 20px;">
              <h3>Pistas:</h3>
              ${(activity.data.clues as Array<{number: number, clue: string}>).map(clue => `
                <p><strong>${clue.number}.</strong> ${clue.clue}</p>
              `).join('')}
            </div>
          `;
          break;
        case ActivityType.WORD_CONNECTION:
          const wordConnectionData = activity.data as any;
          activityContent.innerHTML = `
            <div style="margin: 20px 0;">
              <h3>Conexiones de Palabras:</h3>
              <div class="space-y-4">
                ${(wordConnectionData.connections || []).map((conn: { word1: string; word2: string; connection: string }) => `
                  <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                      <strong>${conn.word1}</strong>
                      <strong>${conn.word2}</strong>
                    </div>
                    <p style="text-align: center; color: #666;">${conn.connection}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          break;
      }
    }

    const opt = {
      margin: 1,
      filename: `${activity.title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error al generar el PDF:', error);
    } finally {
      document.body.removeChild(element);
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case ActivityType.WORD_SEARCH:
        return 'Sopa de Letras';
      case ActivityType.CROSSWORD:
        return 'Crucigrama';
      case ActivityType.WORD_CONNECTION:
        return 'Conectar Palabras';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-8 font-sans">
      <ModalSelectPdf
        open={showPdfModal}
        onClose={handleCloseModal}
        onSelect={handleSelectPdf}
        pdfs={userPdfs}
        title="Selecciona un PDF para Actividades"
      />
      <header className="mb-8">
        <div className="container mx-auto">
          <Link to="/dashboard" className="inline-flex items-center text-sky-400 hover:text-sky-300 transition-colors group">
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-sky-300">Actividades</h1>
          <Link
            to={`/dashboard/activities/${pdfId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Crear Nueva Actividad
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
            <p className="text-slate-300">Cargando actividades...</p>
          </div>
        )}

        {error && !loading && (
          <div className="my-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
            <AlertTriangle size={20} className="mr-3" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="text-center py-10">
            <Puzzle size={48} className="mx-auto text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No hay actividades</h2>
            <p className="text-slate-500">Crea tu primera actividad para este PDF</p>
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md rounded-xl p-6 shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-sm mb-2">
                      {getActivityTypeLabel(activity.type)}
                    </span>
                    <h3 className="text-xl font-semibold text-white mb-1">{activity.title}</h3>
                    <p className="text-slate-400 text-sm">
                      Creada el {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-slate-300 mb-6 line-clamp-2">{activity.description}</p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleDownloadPDF(activity)}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download size={16} />
                    Descargar PDF
                  </button>
                  <Link
                    to={`/dashboard/activities/${activity.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-8 mt-12 text-sm text-slate-500 border-t border-slate-700">
        <p>&copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default ActivitiesListScreen; 