import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle, Puzzle, FileText } from 'lucide-react';
import { getPdfById, getPdfsByTeacher } from '../firebase/firestoreService';
import { aiService } from '../services/aiService';
import type { PdfMetadata } from '../firebase/firestoreService';
import { ActivityType } from '../types/activityTypes';
import { ActivityView } from '../components/activities/ActivityView';
import ModalSelectPdf from '../components/ModalSelectPdf';
import { auth } from '../firebase/firebaseConfig';

const ActivitiesScreen: React.FC = () => {
  const { pdfId } = useParams<{ pdfId: string }>();
  const navigate = useNavigate();
  const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<any>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);

  useEffect(() => {
    if (!pdfId) {
      setShowPdfModal(true);
      setLoadingPdf(false);
      return;
    }

    const fetchDetails = async () => {
      setLoadingPdf(true);
      try {
        const details = await getPdfById(pdfId);
        if (details) {
          setPdfDetails(details);
        } else {
          setErrorPdf("PDF no encontrado.");
        }
      } catch (err) {
        console.error("Error fetching PDF details:", err);
        setErrorPdf("Error al cargar los detalles del PDF.");
      } finally {
        setLoadingPdf(false);
      }
    };

    fetchDetails();
  }, [pdfId]);

  useEffect(() => {
    const fetchUserPdfs = async () => {
      if (!auth.currentUser) return;
      try {
        const pdfs = await getPdfsByTeacher(auth.currentUser.uid);
        setUserPdfs(pdfs);
      } catch (err) {
        console.error("Error cargando PDFs del usuario:", err);
      }
    };
    fetchUserPdfs();
  }, []);

  const handleSelectPdf = (selectedPdfId: string) => {
    setShowPdfModal(false);
    navigate(`/dashboard/activities/${selectedPdfId}`);
  };

  // Generar actividad
  const generateActivity = async (type: ActivityType) => {
    if (!pdfId) {
      setShowPdfModal(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSelectedActivity(type);

    try {
      let generatedActivity;
      
      switch (type) {
        case ActivityType.WORD_SEARCH:
          generatedActivity = await aiService.generateWordSearch(pdfId);
          break;
        case ActivityType.CROSSWORD:
          generatedActivity = await aiService.generateCrossword(pdfId);
          break;
        case ActivityType.WORD_CONNECTION:
          generatedActivity = await aiService.generateWordConnection(pdfId);
          break;
        default:
          throw new Error('Tipo de actividad no soportado');
      }
      
      setActivity({
        ...generatedActivity,
        type,
        title: `Actividad de ${getActivityName(type)}`,
        description: `Generada a partir de: ${pdfDetails?.nombreArchivoOriginal || 'Documento sin nombre'}`
      });
    } catch (err) {
      console.error('Error generando actividad:', err);
      setError(`Error al generar la actividad: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getActivityName = (type: ActivityType): string => {
    switch (type) {
      case ActivityType.WORD_SEARCH: return "Sopa de Letras";
      case ActivityType.CROSSWORD: return "Crucigrama";
      case ActivityType.WORD_CONNECTION: return "Conexión de Palabras";
      default: return "Actividad";
    }
  };

  if (loadingPdf) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (errorPdf) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <ArrowLeft 
            className="w-6 h-6 text-blue-600 cursor-pointer hover:text-blue-800" 
            onClick={() => navigate('/dashboard')} 
          />
          <h1 className="text-2xl font-bold text-gray-900">Actividades</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <p>{errorPdf}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Volver atrás"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Actividades
          </h1>
          {pdfDetails?.nombreArchivoOriginal && (
            <p className="text-sm text-gray-500 mt-1">
              Archivo: {pdfDetails.nombreArchivoOriginal}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-6 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error al generar la actividad</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!activity ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Generar nueva actividad</h2>
          <p className="text-gray-600 text-sm mb-4">
            Selecciona el tipo de actividad que deseas generar a partir del documento actual.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(ActivityType).map((type) => (
              <button
                key={type}
                onClick={() => generateActivity(type)}
                disabled={isGenerating}
                className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all h-full min-h-[120px] ${
                  selectedActivity === type 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Puzzle 
                  className={`w-8 h-8 ${
                    selectedActivity === type ? 'text-blue-600' : 'text-gray-500'
                  }`} 
                />
                <span className="font-medium text-gray-800">{getActivityName(type)}</span>
                <span className="text-xs text-gray-500 text-center">
                  {type === ActivityType.WORD_SEARCH && 'Encuentra las palabras ocultas'}
                  {type === ActivityType.CROSSWORD && 'Completa el crucigrama'}
                  {type === ActivityType.WORD_CONNECTION && 'Conecta las palabras relacionadas'}
                </span>
              </button>
            ))}
          </div>
          
          {isGenerating && (
            <div className="mt-4 text-center text-sm text-blue-600 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generando actividad, por favor espera...
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {getActivityName(activity.type)}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Generado el {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActivity(null)}
                  className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Generar otra actividad
                </button>
              </div>
            </div>
            <div className="p-6">
              <ActivityView activity={activity} />
            </div>
          </div>
        </div>
      )}

      <ModalSelectPdf
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        onSelect={handleSelectPdf}
        pdfs={userPdfs}
        title="Selecciona el PDF para generar la actividad"
      />
    </div>
  );
};

export default ActivitiesScreen;
