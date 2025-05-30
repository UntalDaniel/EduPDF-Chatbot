import React from 'react';
import type { PdfMetadata } from '../firebase/firestoreService';

interface ModalSelectPdfProps {
  open: boolean;
  onClose: () => void;
  onSelect: (pdfId: string) => void;
  pdfs: PdfMetadata[];
  title?: string;
}

const ModalSelectPdf: React.FC<ModalSelectPdfProps> = ({ open, onClose, onSelect, pdfs, title }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 animate-modalEnter">
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-sky-400">{title || 'Selecciona un PDF'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-sky-300 text-lg font-bold px-2 py-1 rounded-full hover:bg-slate-700 transition-colors">✕</button>
        </div>
        <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
          {pdfs.length === 0 ? (
            <div className="text-slate-400 py-8 text-center">No tienes PDFs subidos.</div>
          ) : (
            <ul className="divide-y divide-slate-700">
              {pdfs.map(pdf => (
                <li key={pdf.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sky-200 truncate" title={pdf.titulo || pdf.nombreArchivoOriginal}>{pdf.titulo || pdf.nombreArchivoOriginal}</div>
                    <div className="text-xs text-slate-400 truncate">ID: {pdf.id}</div>
                  </div>
                  <button
                    onClick={() => onSelect(pdf.id!)}
                    className="ml-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Seleccionar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalSelectPdf; 