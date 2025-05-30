import React, { useState, useEffect } from 'react';
import { WordConnectionData } from '../../types/activityTypes';

interface WordConnectionProps {
  data: WordConnectionData;
  onComplete?: () => void;
  readOnly?: boolean;
}

const WordConnection: React.FC<WordConnectionProps> = ({ data, onComplete, readOnly = false }) => {
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [connections, setConnections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedWords(new Set());
    setConnections(new Set());
  }, [data]);

  const handleWordClick = (word: string) => {
    if (readOnly) return;

    const newSelectedWords = new Set(selectedWords);
    if (newSelectedWords.has(word)) {
      newSelectedWords.delete(word);
    } else {
      newSelectedWords.add(word);
    }

    if (newSelectedWords.size === 2) {
      const [word1, word2] = Array.from(newSelectedWords);
      const connection = data.connections.find(
        conn => 
          (conn.word1 === word1 && conn.word2 === word2) ||
          (conn.word1 === word2 && conn.word2 === word1)
      );

      if (connection) {
        setConnections(prev => new Set([...prev, `${word1}-${word2}`]));
        if (connections.size + 1 === data.connections.length) {
          onComplete?.();
        }
      }

      newSelectedWords.clear();
    }

    setSelectedWords(newSelectedWords);
  };

  const isWordSelected = (word: string) => selectedWords.has(word);
  const isConnectionFound = (word1: string, word2: string) => 
    connections.has(`${word1}-${word2}`) || connections.has(`${word2}-${word1}`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Palabras</h3>
          <div className="grid grid-cols-2 gap-4">
            {data.connections.map((conn, index) => (
              <React.Fragment key={index}>
                <button
                  onClick={() => handleWordClick(conn.word1)}
                  className={`
                    p-3 text-center rounded-lg border-2 transition-colors
                    ${isWordSelected(conn.word1)
                      ? 'border-blue-500 bg-blue-50'
                      : isConnectionFound(conn.word1, conn.word2)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }
                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  {conn.word1}
                </button>
                <button
                  onClick={() => handleWordClick(conn.word2)}
                  className={`
                    p-3 text-center rounded-lg border-2 transition-colors
                    ${isWordSelected(conn.word2)
                      ? 'border-blue-500 bg-blue-50'
                      : isConnectionFound(conn.word1, conn.word2)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }
                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  {conn.word2}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Conexiones</h3>
          <div className="space-y-2">
            {data.connections.map((conn, index) => (
              <div
                key={index}
                className={`
                  p-3 rounded-lg border-2
                  ${isConnectionFound(conn.word1, conn.word2)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{conn.word1}</span>
                  <span className="text-gray-500">{conn.connection}</span>
                  <span className="font-medium">{conn.word2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordConnection; 