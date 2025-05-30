import React, { useEffect, useState } from 'react';
import { WordConnectionData } from '../../types/activityTypes';

interface WordConnectionProps {
  data: WordConnectionData & {
    pairs?: Array<{
      term?: string;
      word?: string;
      definition?: string;
      concept?: string;
      relation?: string;
      description?: string;
    }>;
    connections?: Array<{
      word1: string;
      word2: string;
      connection?: string;
    }>;
    words?: string[];
  };
}

interface WordPair {
  id: number;
  word: string;
  definition: string;
  description: string;
  wordLetter: string;
  defLetter: string;
}

export const WordConnection: React.FC<WordConnectionProps> = ({ data }) => {
  const [pairs, setPairs] = useState<WordPair[]>([]);
  const [shuffledDefinitions, setShuffledDefinitions] = useState<{
    id: number;
    text: string;
    letter: string;
  }[]>([]);

  // Function to shuffle array
  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  useEffect(() => {
    if (!data) return;

    // Process word-definition pairs
    let processedPairs: WordPair[] = [];

    // Handle direct connections (from connections array)
    if (data.connections?.length) {
      processedPairs = data.connections.map((conn, index) => ({
        id: index + 1,
        word: String(conn.word1 || '').trim(),
        definition: String(conn.connection || conn.word2 || '').trim(),
        description: '',
        wordLetter: '',
        defLetter: '',
      }));
    } 
    // Handle pairs from data.pairs
    else if (data.pairs?.length) {
      processedPairs = data.pairs.map((pair, index) => {
        // Fix TypeScript error by using the correct property names from the type
        const word = pair.term || '';
        const definition = pair.definition || pair.description || '';
        return {
          id: index + 1,
          word: String(word).trim(),
          definition: String(definition).trim(),
          description: '',
          wordLetter: '',
          defLetter: '',
        };
      });
    }

    // Shuffle the words
    processedPairs = shuffleArray(processedPairs);

    // Assign letters to words and definitions
    const wordLetters = processedPairs.map((_, index) => (index + 1).toString());
    const defLetters = processedPairs.map((_, i) => String.fromCharCode(65 + i));

    // Shuffle definitions
    const shuffledDefs = [...processedPairs]
      .sort(() => Math.random() - 0.5)
      .map((pair, index) => ({
        id: pair.id,
        text: pair.definition,
        letter: defLetters[index],
      }));

    // Assign letters to pairs
    const finalPairs = processedPairs.map((pair, index) => ({
      ...pair,
      wordLetter: wordLetters[index],
      defLetter: defLetters[index],
    }));

    setPairs(finalPairs);
    setShuffledDefinitions(shuffledDefs);
  }, [data]);

  if (!data || !pairs.length) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <p className="text-gray-600">Cargando actividad de conexión de palabras...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm print:p-8 print:shadow-none print:max-w-5xl print:mx-auto">
      <div className="print:flex print:justify-between print:items-center print:mb-6">
        <h2 className="text-2xl font-bold text-black mb-2 print:mb-0 print:text-2xl">
          Conexión de Palabras
        </h2>
        <div className="text-sm text-gray-600 print:text-black print:text-sm">
          Nombre: ___________________________ Fecha: _______________
        </div>
      </div>
      
      <div className="mb-6 print:mb-4 border-b border-gray-200 pb-4">
        <p className="text-black text-sm leading-relaxed">
          <strong className="font-semibold">Instrucciones:</strong> Conecta cada palabra con su definición 
          correspondiente dibujando una línea entre ellas. Escribe el número de la palabra al lado de su definición.
        </p>
      </div>
      
      <div className="space-y-8 print:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8 print:gap-6">
          {/* Words Column */}
          <div className="space-y-5 print:space-y-4">
            <h3 className="text-lg font-semibold text-black border-b-2 border-black pb-1">Palabras</h3>
            <div className="space-y-5 print:space-y-4">
              {pairs.map((item, index) => (
                <div key={`word-${item.id}`} className="flex items-start print:items-center">
                  <div className="flex-shrink-0 w-8 text-right pr-2">
                    <span className="font-bold text-black text-base">{index + 1}.</span>
                  </div>
                  <div className="inline-block px-3 py-1.5 bg-white rounded border border-black print:border-gray-700">
                    <span className="font-medium text-black text-base">{item.word}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Definitions Column */}
          <div className="space-y-5 print:space-y-4">
            <h3 className="text-lg font-semibold text-black border-b-2 border-black pb-1">Definiciones</h3>
            <div className="space-y-5 print:space-y-4">
              {shuffledDefinitions.map((def, index) => (
                <div key={`def-${def.id}`} className="flex items-start">
                  <div className="flex-shrink-0 w-8 text-right pr-2 pt-1">
                    <span className="font-bold text-black text-base">{String.fromCharCode(65 + index)}.</span>
                  </div>
                  <div className="flex-1 px-3 py-1.5 bg-white rounded border border-black print:border-gray-700">
                    <span className="text-black text-sm leading-snug">{def.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-gray-100 rounded border border-gray-300 print:bg-white print:border-gray-200 print:mt-6 print:p-3">
          <p className="font-medium text-black mb-1 text-sm">Recuerda:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Dibuja una línea para unir cada palabra con su definición</li>
            <li>Escribe el número de la palabra al lado de su definición</li>
            <li>Usa lápiz para poder corregir si es necesario</li>
          </ul>
        </div>
      </div>
      
      {/* Answer Key removed as per user request */}
      
      {/* Print-only footer */}
      <div className="hidden print:block mt-12 pt-6 border-t border-gray-300">
        <p className="text-sm text-gray-600">
          Actividad generada por EduPDF - {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default WordConnection;