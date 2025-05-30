// src/screens/CreateActivityScreen.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, FileText, Loader2, AlertTriangle, Puzzle, Save, Sparkles } from 'lucide-react';
import { db } from '../firebase/firebaseConfig';
import { getPdfById, getPdfsByTeacher } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';
import WordSearch from '../components/tools/WordSearch';
import Crossword from '../components/tools/Crossword';
import WordConnection from '../components/tools/WordConnection';
import { createActivity } from '../firebase/activityService';
import { useAuth } from '../hooks/useAuth';
import { ActivityType } from '../types/activityTypes';
import type { WordSearchData, CrosswordData, WordConnectionData, ActivityTypeActivity } from '../types/activityTypes';
import { generateWordSearchGrid, generateCrosswordGrid } from '../utils/gridGenerators';
import { aiService } from '../services/aiService';
import ModalSelectPdf from '../components/ModalSelectPdf';
import { auth } from '../firebase/firebaseConfig';
import { CreateActivity } from '../components/activities/CreateActivity';

type ActivityTypeString = ActivityType;

const CreateActivityScreen: React.FC = () => {
  const { pdfId } = useParams<{ pdfId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);

  const [activityType, setActivityType] = useState<ActivityTypeString>(ActivityType.WORD_SEARCH);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados específicos para cada tipo de actividad
  const [wordSearchWords, setWordSearchWords] = useState<{ word: string; hint: string }[]>([]);
  const [crosswordClues, setCrosswordClues] = useState<{ clue: string; answer: string }[]>([]);
  const [wordConnections, setWordConnections] = useState<{ word1: string; word2: string; connection: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleActivityCreated = (activity: ActivityTypeActivity) => {
    navigate(`/dashboard/activities/${activity.id}`);
  };

  const handleCreateActivity = async () => {
    if (!user || !pdfId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let data: WordSearchData | CrosswordData | WordConnectionData;
      switch (activityType) {
        case ActivityType.WORD_SEARCH:
          if (wordSearchWords.length === 0) {
            throw new Error('Debes agregar al menos una palabra');
          }
          const wordSearchGrid = generateWordSearchGrid(
            wordSearchWords.map(w => w.word.toUpperCase()),
            ['horizontal', 'vertical', 'diagonal']
          );
          data = {
            grid: wordSearchGrid,
            words: wordSearchWords.map(w => w.word.toUpperCase()),
            solution: wordSearchGrid.map(row => [...row])
          } as WordSearchData;
          break;

        case ActivityType.CROSSWORD:
          if (crosswordClues.length === 0) {
            throw new Error('Debes agregar al menos una pista');
          }
          data = {
            grid: [],
            clues: crosswordClues.map((clue, idx) => ({
              number: idx + 1,
              direction: 'across',
              clue: clue.clue,
              answer: clue.answer
            })),
            solution: []
          } as CrosswordData;
          break;

        case ActivityType.WORD_CONNECTION:
          if (wordConnections.length === 0) {
            throw new Error('Debes agregar al menos una conexión');
          }
          data = {
            words: wordConnections.map(wc => wc.word1),
            connections: wordConnections
          } as WordConnectionData;
          break;

        default:
          throw new Error('Tipo de actividad no válido');
      }

      const createdId = await createActivity({
        type: activityType,
        title,
        description,
        pdfId,
        userId: user.uid,
        data
      });
      navigate(`/dashboard/activities/${createdId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la actividad');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!pdfId) {
      setShowPdfModal(true);
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      switch (activityType) {
        case ActivityType.WORD_SEARCH: {
          const result = await aiService.generateWordSearch(pdfId);
          setWordSearchWords(result.words.map((w: string) => ({ word: w, hint: '' })));
          break;
        }
        case ActivityType.CROSSWORD: {
          const result = await aiService.generateCrossword(pdfId);
          setCrosswordClues(result.clues);
          break;
        }
        case ActivityType.WORD_CONNECTION: {
          const result = await aiService.generateWordConnection(pdfId);
          setWordConnections(result.connections);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar la actividad con IA');
    } finally {
      setIsGenerating(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Crear Actividad</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-8 font-sans">
      <header className="mb-8">
        <div className="container mx-auto">
          <Link to="/dashboard" className="inline-flex items-center text-sky-400 hover:text-sky-300 transition-colors group">
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto">
        <div className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md p-6 md:p-8 rounded-xl shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <Settings size={32} className="text-sky-400 mr-4" />
            <h1 className="text-3xl font-bold text-sky-300">Crear Nueva Actividad</h1>
          </div>

          {pdfDetails && !loadingPdf && !errorPdf && (
            <>
              <div className="mb-6 p-4 bg-slate-800/60 rounded-lg border border-slate-600">
                <div className="flex items-start">
                    <FileText size={24} className="text-green-400 mr-3 mt-1 shrink-0" />
                    <div>
                        <h2 className="text-xl font-semibold text-green-300 mb-1">PDF Seleccionado:</h2>
                        <p className="text-slate-200 truncate" title={pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}>
                            {pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}
                        </p>
                        <p className="text-xs text-slate-400">ID: {pdfDetails.id}</p>
                    </div>
                </div>
              </div>

              <CreateActivity pdfId={pdfId} onActivityCreated={handleActivityCreated} />
            </>
          )}
        </div>
        <ModalSelectPdf
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          onSelect={handleSelectPdf}
          pdfs={userPdfs}
          title="Selecciona el PDF para crear la actividad"
        />
      </main>
      <footer className="text-center py-8 mt-12 text-sm text-slate-500 border-t border-slate-700">
        <p>&copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default CreateActivityScreen;
