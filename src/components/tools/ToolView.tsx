import React, { useRef } from 'react';
import { ConceptMapData, MindMapData } from '../../types/activityTypes';
import ConceptMap from './ConceptMap';
import MindMap from './MindMap';
import html2pdf from 'html2pdf.js';
import { Download } from 'lucide-react';

interface ToolViewProps {
  type: 'concept-map' | 'mind-map';
  title: string;
  description: string;
  data: ConceptMapData | MindMapData;
  onClose?: () => void;
}

export const ToolView: React.FC<ToolViewProps> = ({ type, title, description, data, onClose }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const opt = {
      margin: 0.5,
      filename: `${title.replace(/\s+/g, '_').toLowerCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#fff' },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' as 'landscape' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      alert('Error al generar el PDF. Por favor, intente nuevamente.');
    }
  };

  const renderTool = () => {
    switch (type) {
      case 'concept-map':
        return <ConceptMap data={data as ConceptMapData} />;
      case 'mind-map':
        return <MindMap data={data as MindMapData} />;
      default:
        return <div>Tipo de herramienta no soportado</div>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={handleDownload}
            className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <Download className="w-5 h-5 mr-2" />
            Descargar PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div 
        ref={contentRef}
        className="print-content bg-white p-8 rounded-lg border border-gray-200"
        style={{ minHeight: 600 }}
      >
        {/* Cabecera para el PDF */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-800 mb-2">{title}</h1>
          <p className="text-lg text-gray-700 mb-4">{description}</p>
          <p className="text-sm text-gray-500">Generado el {new Date().toLocaleDateString()}</p>
        </div>

        <div className="tool-content">
          {renderTool()}
        </div>
      </div>
    </div>
  );
}; 