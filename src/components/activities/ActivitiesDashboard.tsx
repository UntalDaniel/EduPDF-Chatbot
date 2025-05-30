import React, { useState, useEffect } from 'react';
import { WordSearchGenerator, CrosswordGenerator, MatchConcepts } from './index';
import { WordSearchData, CrosswordData, MatchConceptsData } from '../../types/activityTypes';
import { usePDFs } from '../../hooks/usePDFs';
import { aiService } from '../../services/aiService';
import { useSearchParams } from 'react-router-dom';

// Simulación de PDFs disponibles
const mockPdfs = [
  { id: 'pdf1', name: 'Marketing Digital.pdf' },
  { id: 'pdf2', name: 'Historia Universal.pdf' },
];

// Simulación de datos de actividades (luego se reemplaza por fetch real)
const mockWordSearch: WordSearchData = {
  grid: [
    ['M', 'A', 'R', 'K', 'E', 'T'],
    ['I', 'N', 'G', 'D', 'I', 'G'],
    ['I', 'T', 'A', 'L', 'S', 'O'],
    ['C', 'O', 'N', 'T', 'E', 'N'],
    ['T', 'O', 'S', 'E', 'O', 'S'],
  ],
  words: ['MARKETING', 'DIGITAL', 'SEO', 'CONTENIDOS'],
  solution: [],
};
const mockCrossword: CrosswordData = {
  grid: [
    ['C', '', '', '', 'S'],
    ['', '', '', '', 'E'],
    ['', '', '', '', 'O'],
    ['M', 'A', 'R', 'K', 'E'],
    ['', '', '', '', 'T'],
  ],
  clues: [
    { number: 1, direction: 'across', clue: 'Estrategia de posicionamiento', answer: 'SEO' },
    { number: 2, direction: 'down', clue: 'Disciplina de promoción', answer: 'MARKETING' },
  ],
  solution: [],
};
const mockMatchConcepts: MatchConceptsData = {
  words: ['SEO', 'SEM', 'Branding'],
  concepts: ['Optimización en buscadores', 'Publicidad en buscadores', 'Gestión de marca'],
  pairs: [
    { word: 'SEO', concept: 'Optimización en buscadores' },
    { word: 'SEM', concept: 'Publicidad en buscadores' },
    { word: 'Branding', concept: 'Gestión de marca' },
  ],
};

const ActivitiesDashboard: React.FC = () => {
  const { pdfs, loading: loadingPdfs, error: errorPdfs } = usePDFs();
  const [selectedPdf, setSelectedPdf] = useState<string>('');
  const [activityType, setActivityType] = useState<string>('');
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [errorActivity, setErrorActivity] = useState<string | null>(null);
  const [wordSearchData, setWordSearchData] = useState<WordSearchData | null>(null);
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(null);
  const [matchConceptsData, setMatchConceptsData] = useState<MatchConceptsData | null>(null);
  const [searchParams] = useSearchParams();

  // Seleccionar PDF automáticamente si viene por parámetro
  useEffect(() => {
    const pdfIdParam = searchParams.get('pdfId');
    if (pdfIdParam && pdfs.some(pdf => pdf.id === pdfIdParam)) {
      setSelectedPdf(pdfIdParam);
    }
  }, [searchParams, pdfs]);

  const handleGenerate = async () => {
    if (!selectedPdf || !activityType) return;
    setLoadingActivity(true);
    setErrorActivity(null);
    setWordSearchData(null);
    setCrosswordData(null);
    setMatchConceptsData(null);
    try {
      if (activityType === 'word-search') {
        const data = await aiService.generateWordSearch(selectedPdf);
        setWordSearchData(data);
      } else if (activityType === 'crossword') {
        const data = await aiService.generateCrossword(selectedPdf);
        setCrosswordData(data);
      } else if (activityType === 'match-concepts') {
        const data = await aiService.generateMatchConcepts(selectedPdf);
        setMatchConceptsData(data);
      }
    } catch (err) {
      setErrorActivity('Error al generar la actividad. Intenta de nuevo.');
    } finally {
      setLoadingActivity(false);
    }
  };

  const renderActivity = () => {
    if (loadingActivity) return <div className="text-center py-8">Generando actividad...</div>;
    if (errorActivity) return <div className="text-center text-red-500 py-8">{errorActivity}</div>;
    if (activityType === 'word-search' && wordSearchData) {
      return <WordSearchGenerator data={wordSearchData} />;
    }
    if (activityType === 'crossword' && crosswordData) {
      return <CrosswordGenerator data={crosswordData} />;
    }
    if (activityType === 'match-concepts' && matchConceptsData) {
      return <MatchConcepts data={matchConceptsData} />;
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Generador de Actividades</h1>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Selecciona un PDF:</label>
        {loadingPdfs ? (
          <div className="text-slate-400 py-2">Cargando PDFs...</div>
        ) : errorPdfs ? (
          <div className="text-red-400 py-2">{errorPdfs}</div>
        ) : (
          <select
            className="border rounded px-3 py-2 w-full"
            value={selectedPdf}
            onChange={e => setSelectedPdf(e.target.value)}
          >
            <option value="">-- Selecciona --</option>
            {pdfs.map(pdf => (
              <option key={pdf.id} value={pdf.id}>{pdf.title || pdf.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Tipo de actividad:</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={activityType}
          onChange={e => setActivityType(e.target.value)}
          disabled={!selectedPdf}
        >
          <option value="">-- Selecciona --</option>
          <option value="WORD_SEARCH">Sopa de letras</option>
          <option value="CROSSWORD">Crucigrama</option>
          <option value="WORD_CONNECTION">Conexión de Palabras</option>
        </select>
      </div>
      <div className="mb-4">
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition"
          onClick={handleGenerate}
          disabled={!selectedPdf || !activityType || loadingActivity}
        >
          Generar actividad
        </button>
      </div>
      <div className="mt-8">
        {selectedPdf && activityType && renderActivity()}
      </div>
    </div>
  );
};

export default ActivitiesDashboard; 