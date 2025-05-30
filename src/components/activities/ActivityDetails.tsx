import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActivities } from '../../hooks/useActivities';
import { ActivityType } from '../../types/activityTypes';
import type { ActivityTypeActivity, WordSearchActivity, CrosswordActivity, WordConnectionActivity } from '../../types/activityTypes';
import { WordSearch } from './WordSearch';
import { Crossword } from './Crossword';
import { WordConnection } from './WordConnection';
import html2pdf from 'html2pdf.js';
import { Download } from 'lucide-react';

// Utilidad para asegurar que grid sea string[][]
function ensureGridIs2DArray(grid: any): string[][] {
  if (!Array.isArray(grid)) return [];
  if (grid.length === 0) return [];
  if (Array.isArray(grid[0])) {
    // Ya es string[][]
    return grid as string[][];
  } else if (typeof grid[0] === 'string') {
    // Es string[] (cada fila es un string)
    return (grid as string[]).map(row => row.split(''));
  }
  return [];
}

// Funciones de mapeo robusto para cada tipo de actividad
function mapBackendToWordSearchData(raw: any) {
  return {
    grid: ensureGridIs2DArray(raw.grid),
    words: Array.isArray(raw.words)
      ? raw.words
      : Array.isArray(raw.palabras)
        ? raw.palabras
        : [],
    solution: raw.solution ? ensureGridIs2DArray(raw.solution) : ensureGridIs2DArray(raw.grid)
  };
}

function mapBackendToCrosswordData(raw: any) {
  let clues: any[] = [];
  if (raw.clues && typeof raw.clues === 'object' && (raw.clues.across || raw.clues.down)) {
    const across = Array.isArray(raw.clues.across)
      ? raw.clues.across.map((c: any) => ({ ...c, direction: 'across' }))
      : [];
    const down = Array.isArray(raw.clues.down)
      ? raw.clues.down.map((c: any) => ({ ...c, direction: 'down' }))
      : [];
    clues = [...across, ...down];
  } else if (Array.isArray(raw.clues)) {
    clues = raw.clues;
  } else if (Array.isArray(raw.pistas)) {
    clues = raw.pistas.map((p: any) => ({
      number: p.num || p.number,
      direction: p.tipo || p.direction,
      clue: p.texto || p.clue,
      answer: p.respuesta || p.answer
    }));
  }
  return {
    grid: ensureGridIs2DArray(raw.grid),
    clues,
    solution: raw.solution ? ensureGridIs2DArray(raw.solution) : ensureGridIs2DArray(raw.grid)
  };
}

function mapBackendToWordConnectionData(raw: any) {
  return {
    words: Array.isArray(raw.words)
      ? raw.words
      : Array.isArray(raw.connections)
        ? raw.connections.map((c: any) => c.word1)
        : [],
    connections: Array.isArray(raw.connections)
      ? raw.connections
      : Array.isArray(raw.pairs)
        ? raw.pairs.map((p: any) => ({
            word1: p.word1 || p.word,
            word2: p.word2 || p.concept,
            connection: p.connection || p.descripcion || p.description || ''
          }))
        : []
  };
}

export const ActivityDetails: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { getActivityById, loading, error } = useActivities();
  const [activity, setActivity] = useState<ActivityTypeActivity | null>(null);

  useEffect(() => {
    const loadActivity = async () => {
      if (activityId) {
        const loadedActivity = await getActivityById(activityId);
        if (loadedActivity) {
          setActivity(loadedActivity as ActivityTypeActivity);
        }
      }
    };

    loadActivity();
  }, [activityId, getActivityById]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        Error: {error}
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center p-4 text-gray-500">
        Actividad no encontrada
      </div>
    );
  }

  const renderActivity = () => {
    switch (activity.type) {
      case ActivityType.WORD_SEARCH:
        return <WordSearch data={mapBackendToWordSearchData((activity as WordSearchActivity).data)} />;
      case ActivityType.CROSSWORD:
        return <Crossword data={mapBackendToCrosswordData((activity as CrosswordActivity).data)} />;
      case ActivityType.WORD_CONNECTION:
        return <WordConnection data={mapBackendToWordConnectionData((activity as WordConnectionActivity).data)} />;
      default:
        return (
          <div className="text-center p-4 text-gray-500">
            Tipo de actividad no soportado
          </div>
        );
    }
  };

  // Lógica de descarga PDF simple, sin escalado ni forzar a una sola hoja
  const handleDownloadPDF = () => {
    const content = document.getElementById('activity-detail-content');
    if (!content) return;
    const opt = {
      margin: 0.5,
      filename: `${activity?.title || 'actividad'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(content).save();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div id="activity-detail-content">
          <h1 className="text-2xl font-bold mb-4">{activity.title}</h1>
          <p className="text-gray-600 mb-6">{activity.description}</p>
          {renderActivity()}
        </div>
        <div className="flex justify-center mt-8">
          <button
            onClick={handleDownloadPDF}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow transition-colors"
          >
            <Download size={20} /> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}; 