import React, { useState } from 'react';
import { usePDFs } from '../../hooks/usePDFs';
import { useNavigate } from 'react-router-dom';

const ToolsDashboard: React.FC = () => {
  const { pdfs, loading, error } = usePDFs();
  const [selectedPdf, setSelectedPdf] = useState<string>('');
  const navigate = useNavigate();

  const handleGoToTools = () => {
    if (selectedPdf) {
      navigate(`/dashboard/tools/${selectedPdf}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Herramientas Inteligentes</h1>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Selecciona un PDF:</label>
        {loading ? (
          <div className="text-slate-400 py-2">Cargando PDFs...</div>
        ) : error ? (
          <div className="text-red-400 py-2">{error}</div>
        ) : (
          <select
            className="border rounded px-3 py-2 w-full"
            value={selectedPdf}
            onChange={e => setSelectedPdf(e.target.value)}
          >
            <option value="">-- Selecciona --</option>
            {pdfs.map(pdf => (
              <option key={pdf.id} value={pdf.id}>{pdf.title}</option>
            ))}
          </select>
        )}
      </div>
      <button
        className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition"
        onClick={handleGoToTools}
        disabled={!selectedPdf}
      >
        Ir a Herramientas
      </button>
    </div>
  );
};

export default ToolsDashboard; 