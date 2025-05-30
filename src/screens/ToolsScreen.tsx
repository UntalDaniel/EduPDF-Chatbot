import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle, Brain, Network } from 'lucide-react';
import { getPdfById, getPdfsByTeacher } from '../firebase/firestoreService';
import { aiService } from '../services/aiService';
import type { PdfMetadata } from '../firebase/firestoreService';
import type { ConceptMapData, MindMapData } from '../types/activityTypes';
import { ConceptMap, MindMap } from '../components/tools';
import ModalSelectPdf from '../components/ModalSelectPdf';
import { auth } from '../firebase/firebaseConfig';

const ToolsScreen: React.FC = () => {
  const { pdfId } = useParams<{ pdfId: string }>();
  const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<'conceptMap' | 'mindMap'>('conceptMap');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conceptMap, setConceptMap] = useState<ConceptMapData | null>(null);
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!pdfId) {
      setPdfDetails(null);
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

  // Cargar PDFs del usuario para el modal
  useEffect(() => {
    const fetchPdfs = async () => {
      if (!auth?.currentUser) return;
      const pdfs = await getPdfsByTeacher(auth.currentUser.uid);
      setUserPdfs(pdfs);
    };
    if (showPdfModal) fetchPdfs();
  }, [showPdfModal]);

  const handleGenerate = async () => {
    if (!pdfId) {
      setShowPdfModal(true);
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      if (selectedTool === 'conceptMap') {
        const result = await aiService.generateConceptMap(pdfId);
        setConceptMap(result);
      } else {
        const result = await aiService.generateMindMap(pdfId);
        setMindMap(result);
      }
    } catch (err) {
      console.error('Error al generar mapa:', err);
      setError(err instanceof Error ? err.message : 'Error al generar el mapa con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPdf = (selectedPdfId: string) => {
    setShowPdfModal(false);
    navigate(`/dashboard/tools/${selectedPdfId}`);
  };

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
        <div className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md p-6 md:p-8 rounded-xl shadow-xl">
          <div className="flex items-center mb-6">
            <Brain size={32} className="text-sky-400 mr-4" />
            <h1 className="text-3xl font-bold text-sky-300">Herramientas Inteligentes</h1>
          </div>

          {loadingPdf && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
              <p className="text-slate-300">Cargando detalles del PDF...</p>
            </div>
          )}

          {errorPdf && !loadingPdf && (
            <div className="my-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
              <AlertTriangle size={20} className="mr-3" />
              <span>{errorPdf}</span>
            </div>
          )}

          {!loadingPdf && !errorPdf && pdfDetails && (
            <>
              <div className="mb-6 p-4 bg-slate-800/60 rounded-lg border border-slate-600">
                <div className="flex items-start">
                  <Network size={24} className="text-green-400 mr-3 mt-1 shrink-0" />
                  <div>
                    <h2 className="text-xl font-semibold text-green-300 mb-1">PDF Seleccionado:</h2>
                    <p className="text-slate-200 truncate" title={pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}>
                      {pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}
                    </p>
                    <p className="text-xs text-slate-400">ID: {pdfDetails.id}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => setSelectedTool('conceptMap')}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      selectedTool === 'conceptMap'
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Mapa Conceptual
                  </button>
                  <button
                    onClick={() => setSelectedTool('mindMap')}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      selectedTool === 'mindMap'
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Mapa Mental
                  </button>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Brain className="h-5 w-5 mr-2" />
                      Generar con IA
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isGenerating && (
                <div className="mb-4 p-4 bg-blue-500/20 text-blue-300 border border-blue-500 rounded-lg flex items-center">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin flex-shrink-0" />
                  <span>Generando mapa {selectedTool === 'conceptMap' ? 'conceptual' : 'mental'}...</span>
                </div>
              )}

              <div className="mt-8">
                {selectedTool === 'conceptMap' && conceptMap && (
                  <ConceptMap data={conceptMap} />
                )}
                {selectedTool === 'mindMap' && mindMap && (
                  <MindMap data={mindMap} />
                )}
              </div>
            </>
          )}
        </div>
        <ModalSelectPdf
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          onSelect={handleSelectPdf}
          pdfs={userPdfs}
          title="Selecciona el PDF para generar la herramienta"
        />
      </main>
    </div>
  );
};

export default ToolsScreen; 