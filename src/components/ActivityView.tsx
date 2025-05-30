import React from 'react';
import { ActivityTypeActivity } from '../types/activityTypes';
import { ActivityType } from '../types/activityTypes';
import WordSearch from './tools/WordSearch';
import Crossword from './tools/Crossword';
import WordConnection from './tools/WordConnection';
import html2pdf from 'html2pdf.js';

interface ActivityViewProps {
  activity: ActivityTypeActivity;
  onClose?: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ activity, onClose }) => {
  const handleDownload = () => {
    const element = document.getElementById('activity-content');
    if (!element) return;

    const opt = {
      margin: 1,
      filename: `${activity.title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  const renderActivity = () => {
    switch (activity.type) {
      case ActivityType.WORD_SEARCH:
        return <WordSearch data={activity.data} />;
      case ActivityType.CROSSWORD:
        return <Crossword data={activity.data} />;
      case ActivityType.WORD_CONNECTION:
        return <WordConnection data={activity.data} />;
      default:
        return <div>Tipo de actividad no soportado</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{activity.title}</h2>
              <p className="text-gray-600 mt-1">{activity.description}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Descargar PDF
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>

          <div id="activity-content" className="mt-6">
            {renderActivity()}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Instrucciones:</h3>
            {activity.type === ActivityType.WORD_SEARCH && (
              <ul className="list-disc list-inside space-y-1">
                <li>Encuentra las palabras listadas en la sopa de letras</li>
                <li>Las palabras pueden estar en horizontal, vertical o diagonal</li>
                <li>Pueden estar escritas de izquierda a derecha o de derecha a izquierda</li>
                <li>Usa las pistas si necesitas ayuda</li>
              </ul>
            )}
            {activity.type === ActivityType.CROSSWORD && (
              <ul className="list-disc list-inside space-y-1">
                <li>Completa el crucigrama usando las pistas proporcionadas</li>
                <li>Las pistas están divididas en horizontales y verticales</li>
                <li>Cada número corresponde a una casilla en el crucigrama</li>
                <li>Las casillas negras separan las palabras</li>
              </ul>
            )}
            {activity.type === ActivityType.WORD_CONNECTION && (
              <ul className="list-disc list-inside space-y-1">
                <li>Conecta cada palabra con su concepto correspondiente</li>
                <li>Lee la descripción para entender la relación</li>
                <li>Puedes usar las pistas si necesitas ayuda</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 