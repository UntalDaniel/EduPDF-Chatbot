import React from 'react';
import { WordSearchData } from '../../types/activityTypes';
import ActivityPreview from './ActivityPreview';
import jsPDF from 'jspdf';

interface WordSearchGeneratorProps {
  data: WordSearchData;
  onDownload?: () => void;
}

const WordSearchGenerator: React.FC<WordSearchGeneratorProps> = ({ data, onDownload }) => {
  const handleDownload = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Sopa de Letras', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    let y = 35;
    // Dibujar la cuadrícula
    data.grid.forEach((row, i) => {
      let rowText = row.join(' ');
      doc.text(rowText, 20, y);
      y += 8;
    });
    y += 8;
    doc.setFontSize(13);
    doc.text('Palabras a buscar:', 20, y);
    y += 7;
    doc.setFontSize(11);
    data.words.forEach((word) => {
      doc.text(`- ${word}`, 25, y);
      y += 6;
    });
    doc.save('sopa_de_letras.pdf');
  };

  return (
    <ActivityPreview title="Sopa de letras" onDownload={handleDownload}>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {data.grid.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border px-2 py-1 text-center font-mono">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Palabras a buscar:</h3>
        <ul className="flex flex-wrap gap-2 mt-2">
          {data.words.map((word, idx) => (
            <li key={idx} className="bg-gray-200 rounded px-2 py-1">{word}</li>
          ))}
        </ul>
      </div>
    </ActivityPreview>
  );
};

export default WordSearchGenerator; 