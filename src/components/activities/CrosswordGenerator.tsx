import React from 'react';
import { CrosswordData } from '../../types/activityTypes';
import ActivityPreview from './ActivityPreview';
import jsPDF from 'jspdf';

interface CrosswordGeneratorProps {
  data: CrosswordData;
  onDownload?: () => void;
}

const CrosswordGenerator: React.FC<CrosswordGeneratorProps> = ({ data, onDownload }) => {
  const handleDownload = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Crucigrama', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    let y = 35;
    // Dibujar la cuadrícula
    data.grid.forEach((row) => {
      let rowText = row.map(cell => (cell === '' ? ' ' : cell)).join(' ');
      doc.text(rowText, 20, y);
      y += 8;
    });
    y += 8;
    doc.setFontSize(13);
    doc.text('Pistas:', 20, y);
    y += 7;
    doc.setFontSize(11);
    data.clues.forEach((clue) => {
      doc.text(`${clue.number}. (${clue.direction}) ${clue.clue}`, 25, y);
      y += 6;
    });
    doc.save('crucigrama.pdf');
  };

  return (
    <ActivityPreview title="Crucigrama" onDownload={handleDownload}>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {data.grid.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={`border w-8 h-8 text-center font-mono ${cell === '' ? 'bg-gray-300' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Pistas:</h3>
        <ul className="mt-2">
          {data.clues.map((clue, idx) => (
            <li key={idx}>
              <span className="font-bold">{clue.number}.</span> ({clue.direction}) {clue.clue}
            </li>
          ))}
        </ul>
      </div>
    </ActivityPreview>
  );
};

export default CrosswordGenerator; 