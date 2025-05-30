import React, { useState, useEffect } from 'react';
import { WordSearchData } from '../../types/activityTypes';

interface WordSearchProps {
  data: WordSearchData;
  onWordFound?: (word: string) => void;
  readOnly?: boolean;
}

const WordSearch: React.FC<WordSearchProps> = ({ data, onWordFound, readOnly = false }) => {
  const [selectedCells, setSelectedCells] = useState<number[][]>([]);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFoundWords(new Set());
    setSelectedCells([]);
  }, [data]);

  const handleCellClick = (row: number, col: number) => {
    if (readOnly) return;

    const newSelectedCells = [...selectedCells, [row, col]];
    setSelectedCells(newSelectedCells);

    const word = newSelectedCells
      .map(([r, c]) => data.grid[r][c])
      .join('')
      .toLowerCase();

    const reversedWord = word.split('').reverse().join('');

    const foundWord = data.words.find(
      w => w.word.toLowerCase() === word || w.word.toLowerCase() === reversedWord
    );

    if (foundWord && !foundWords.has(foundWord.word)) {
      setFoundWords(prev => new Set([...prev, foundWord.word]));
      onWordFound?.(foundWord.word);
    }
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (readOnly || selectedCells.length === 0) return;

    const lastCell = selectedCells[selectedCells.length - 1];
    const [lastRow, lastCol] = lastCell;

    // Solo permitir selección en línea recta
    if (row === lastRow || col === lastCol || 
        Math.abs(row - lastRow) === Math.abs(col - lastCol)) {
      setSelectedCells(prev => [...prev, [row, col]]);
    }
  };

  const handleMouseUp = () => {
    setSelectedCells([]);
  };

  return (
    <div className="space-y-4">
      <div
        className="grid gap-1 select-none"
        style={{
          gridTemplateColumns: `repeat(${data.grid[0].length}, minmax(0, 1fr))`
        }}
        onMouseUp={handleMouseUp}
      >
        {data.grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                aspect-square flex items-center justify-center text-lg font-bold
                border border-gray-300 cursor-pointer
                ${selectedCells.some(([r, c]) => r === rowIndex && c === colIndex)
                  ? 'bg-blue-500 text-white'
                  : 'bg-white hover:bg-gray-100'
                }
              `}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
            >
              {cell}
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Palabras a encontrar:</h3>
          <ul className="space-y-1">
            {data.words.map((word, index) => (
              <li
                key={index}
                className={`
                  flex items-center space-x-2
                  ${foundWords.has(word.word) ? 'text-green-600 line-through' : 'text-gray-700'}
                `}
              >
                <span>{word.word}</span>
                <span className="text-sm text-gray-500">({word.hint})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WordSearch; 