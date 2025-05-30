import React from 'react';
import { MatchConceptsData } from '../../types/activityTypes';
import jsPDF from 'jspdf';
import ActivityPreview from './ActivityPreview';

interface MatchConceptsProps {
  data: MatchConceptsData;
}

const MatchConcepts: React.FC<MatchConceptsProps> = ({ data }) => {
  // Función para mezclar un array asegurando que ningún elemento quede en su posición original (derangement)
  function mezclarSinCoincidencias<T>(original: T[]): T[] {
    let arr: T[] = [];
    let coincide = true;
    while (coincide) {
      arr = original
        .map(valor => ({ valor, orden: Math.random() }))
        .sort((a, b) => a.orden - b.orden)
        .map(({ valor }) => valor);
      coincide = arr.some((el, idx) => el === original[idx]);
    }
    return arr;
  }

  // Mezclar conceptos solo una vez al montar el componente, garantizando que no coincidan con su palabra
  const [conceptosMezclados] = React.useState(() => mezclarSinCoincidencias(data.concepts));

  // Estado para las selecciones del usuario
  const [selecciones, setSelecciones] = React.useState<(string | undefined)[]>(Array(data.words.length).fill(undefined));

  // Manejar el cambio de selección
  const handleSeleccion = (idx: number, value: string) => {
    setSelecciones(prev => {
      const nuevo = [...prev];
      nuevo[idx] = value;
      return nuevo;
    });
  };

  const handleDownload = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Asociar conceptos', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    let y = 35;
    doc.text('Palabras', 20, y);
    doc.text('Conceptos', 90, y);
    y += 8;
    const maxRows = Math.max(data.words.length, conceptosMezclados.length);
    for (let i = 0; i < maxRows; i++) {
      doc.text(data.words[i] || '', 20, y);
      doc.text(conceptosMezclados[i] || '', 90, y);
      y += 7;
    }
    y += 8;
    doc.setFontSize(10);
    doc.text('Instrucción: Une cada palabra con el concepto correcto.', 20, y);
    doc.save('asociar_conceptos.pdf');
  };

  return (
    <ActivityPreview title="Asociar conceptos" onDownload={handleDownload}>
      {/* Vista previa de la actividad */}
      <div className="flex gap-8">
        <div>
          <h3>Palabras</h3>
          <ul>
            {data.words.map((word, idx) => (
              <li key={idx} className="mb-2">{word}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Definición</h3>
          <ul>
            {conceptosMezclados.map((concept, idx) => (
              <li key={idx} className="mb-2 bg-green-100 p-2 rounded">{concept}</li>
            ))}
          </ul>
        </div>
      </div>
    </ActivityPreview>
  );
};

export default MatchConcepts; 