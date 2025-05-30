import React, { useState } from 'react';
import { generateConceptMap, generateMindMap } from '../../services/aiService';
import { ToolView } from './ToolView';

interface CreateToolProps {
  pdfId?: string;
  onToolCreated?: () => void;
}

export const CreateTool: React.FC<CreateToolProps> = ({ pdfId, onToolCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'concept-map' | 'mind-map'>('concept-map');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedTool, setGeneratedTool] = useState<{
    type: 'concept-map' | 'mind-map';
    data: any;
  } | null>(null);

  const handleGenerateTool = async () => {
    if (!pdfId) {
      alert('Se requiere un ID de PDF para generar la herramienta');
      return;
    }

    setGenerating(true);
    try {
      let generatedData;
      switch (type) {
        case 'concept-map':
          generatedData = await generateConceptMap(pdfId);
          break;
        case 'mind-map':
          generatedData = await generateMindMap(pdfId);
          break;
        default:
          throw new Error('Tipo de herramienta no válido');
      }

      setGeneratedTool({
        type,
        data: generatedData,
      });

      if (onToolCreated) {
        onToolCreated();
      }
    } catch (err) {
      console.error('Error al generar la herramienta:', err);
      alert('Error al generar la herramienta. Por favor, intente nuevamente.');
    } finally {
      setGenerating(false);
    }
  };

  if (generatedTool) {
    return (
      <div className="space-y-6">
        <ToolView
          type={generatedTool.type}
          title={title || `${type === 'concept-map' ? 'Mapa Conceptual' : 'Mapa Mental'} generado`}
          description={description || `${type === 'concept-map' ? 'Mapa Conceptual' : 'Mapa Mental'} generado automáticamente`}
          data={generatedTool.data}
          onClose={() => setGeneratedTool(null)}
        />
        <div className="flex justify-center">
          <button
            onClick={() => setGeneratedTool(null)}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
          >
            Generar Nueva Herramienta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">Generar Nueva Herramienta</h2>
      
      <form onSubmit={(e) => { e.preventDefault(); handleGenerateTool(); }} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Título
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Herramienta
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'concept-map' | 'mind-map')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="concept-map">Mapa Conceptual</option>
            <option value="mind-map">Mapa Mental</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || generating}
          className={`w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors ${
            (loading || generating) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {generating ? 'Generando...' : 'Generar con IA'}
        </button>
      </form>
    </div>
  );
}; 