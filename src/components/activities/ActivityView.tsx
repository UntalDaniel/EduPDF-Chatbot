import React, { useState } from 'react';
import { 
  ActivityTypeActivity, 
  ActivityType, 
  WordSearchActivity, 
  CrosswordActivity, 
  WordConnectionActivity,
  WordSearchData,
  CrosswordData,
  WordConnectionData
} from '../../types/activityTypes';
import { WordSearch } from './WordSearch';
import { Crossword } from './Crossword';
import { WordConnection } from './WordConnection';
import { PrintableView } from './PrintableView';
import { Button } from "@/components/ui/button";
import { FileText, Download } from 'lucide-react';

interface ActivityViewProps {
  activity: WordSearchActivity | CrosswordActivity | WordConnectionActivity;
  onDownloadPdf?: () => Promise<void>;
  isGeneratingPdf?: boolean;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ 
  activity, 
  onDownloadPdf, 
  isGeneratingPdf = false 
}) => {
  const [showPdf, setShowPdf] = useState(false);

  const handleDownloadClick = async () => {
    if (onDownloadPdf) {
      await onDownloadPdf();
    }
  };
  // Función para normalizar los datos de la actividad
  const normalizeActivityData = (activity: any) => {
    // Si la actividad ya tiene la estructura esperada, la devolvemos tal cual
    if (activity.data) {
      return activity.data;
    }
    
    // Si no tiene .data, asumimos que las propiedades están en el objeto raíz
    // Esto es para compatibilidad con el formato antiguo
    const { id, type, title, description, pdfId, createdAt, updatedAt, userId, ...data } = activity;
    return data;
  };

  const renderActivity = () => {
    try {
      // Usar una función de tipo guard para verificar el tipo de actividad
      const isWordSearch = (act: any): act is WordSearchActivity => 
        act.type === ActivityType.WORD_SEARCH;
      const isCrossword = (act: any): act is CrosswordActivity => 
        act.type === ActivityType.CROSSWORD;
      const isWordConnection = (act: any): act is WordConnectionActivity => 
        act.type === ActivityType.WORD_CONNECTION;

      const activityData = normalizeActivityData(activity);
      console.log('Datos de la actividad normalizados:', activityData);

      if (isWordSearch(activity)) {
        // Verificar si la actividad tiene la estructura esperada para WordSearch
        const wordSearchData = activityData as WordSearchData;
        const hasRequiredFields = 
          wordSearchData.words && 
          Array.isArray(wordSearchData.words) && 
          wordSearchData.words.length > 0 &&
          wordSearchData.grid && 
          Array.isArray(wordSearchData.grid) && 
          wordSearchData.grid.length > 0;
          
        if (!hasRequiredFields) {
          console.error('Estructura de datos incorrecta para WordSearch:', wordSearchData);
          return (
            <div className="text-center text-red-500 p-4">
              Error: La estructura de datos de la sopa de letras es incorrecta.
            </div>
          );
        }
        
        return <WordSearch data={wordSearchData} />;
      } else if (isCrossword(activity)) {
        return <Crossword data={activityData as CrosswordData} />;
      } else if (isWordConnection(activity)) {
        // Asegurarse de que los datos de WordConnection tengan el formato correcto
        const wordConnectionData = activityData as WordConnectionData;
        
        // Si hay pairs pero no connections, convertir pairs a connections
        if (wordConnectionData.pairs && !wordConnectionData.connections) {
          wordConnectionData.connections = wordConnectionData.pairs
            .filter(pair => pair.term && pair.definition) // Solo pares con term y definition definidos
            .map((pair, index) => ({
              word1: pair.term || '',
              word2: pair.definition || '',
              connection: pair.relation || pair.description || ''
            }));
        }
        
        // Filtrar conexiones que tengan tanto word1 como word2 definidos
        const validConnections = wordConnectionData.connections?.filter(
          conn => conn.word1 && conn.word2
        ) || [];
        
        // Si no hay conexiones válidas, mostrar un mensaje de error
        if (validConnections.length === 0) {
          return (
            <div className="text-center text-red-500 p-4">
              Error: No se encontraron conexiones válidas para esta actividad.
            </div>
          );
        }
        
        // Crear un nuevo objeto con el tipo exacto que espera WordConnection
        type ValidConnection = { word1: string; word2: string; connection?: string };
        type WordConnectionPropsType = {
          pairs?: Array<{
            term?: string;
            word?: string;
            definition?: string;
            concept?: string;
            relation?: string;
            description?: string;
          }>;
          connections?: ValidConnection[];
          words?: string[];
        };
        
        const validatedData: WordConnectionPropsType = {
          ...wordConnectionData,
          connections: validConnections
            .filter((conn): conn is { word1: string; word2: string; connection?: string } => 
              !!conn.word1 && !!conn.word2
            )
            .map(conn => ({
              word1: conn.word1,
              word2: conn.word2,
              connection: conn.connection
            }))
        };
        
        return <WordConnection data={validatedData} />;
      }

      // Si llegamos aquí, el tipo de actividad no es compatible
      return (
        <div className="text-center text-red-500 p-4">
          Error: Tipo de actividad no compatible.
        </div>
      );
    } catch (error) {
      console.error('Error al renderizar la actividad:', error);
      return (
        <div className="text-center text-red-500 p-4">
          Ocurrió un error al cargar la actividad. Por favor, inténtalo de nuevo.
        </div>
      );
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{activity.title}</h2>
                {activity.description && (
                  <p className="text-gray-600 mt-1">{activity.description}</p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowPdf(!showPdf)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {showPdf ? 'Ver Actividad' : 'Vista Previa'}
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleDownloadClick}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </div>
            </div>
          </div>
          
          {showPdf ? (
            <div className="h-[80vh] border rounded-md overflow-hidden">
              <PrintableView activity={activity} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                {renderActivity()}
              </div>

              {activity.type === ActivityType.WORD_SEARCH && (activity.data as WordSearchData)?.words && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="font-medium text-blue-800 mb-3">Palabras a encontrar:</h3>
                  <div className="flex flex-wrap gap-2">
                    {(activity.data as WordSearchData).words.map((word: string, index: number) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-white text-blue-800 text-sm font-medium rounded-full border border-blue-200"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityView;
