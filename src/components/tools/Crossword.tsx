import React, { useState, useEffect } from 'react';
import { CrosswordData } from '../../types/activityTypes';

interface CrosswordProps {
  data: CrosswordData;
  onComplete?: () => void;
  readOnly?: boolean;
}

const Crossword: React.FC<CrosswordProps> = ({ data, onComplete, readOnly = false }) => {
  const [answers, setAnswers] = useState<string[][]>(
    data.grid.map(row => row.map(cell => cell === '#' ? '#' : ''))
  );
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'across' | 'down'>('across');

  useEffect(() => {
    setAnswers(data.grid.map(row => row.map(cell => cell === '#' ? '#' : '')));
    setSelectedCell(null);
  }, [data]);

  const handleCellClick = (row: number, col: number) => {
    if (readOnly || data.grid[row][col] === '#') return;

    if (selectedCell && selectedCell[0] === row && selectedCell[1] === col) {
      setSelectedDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell([row, col]);
      setSelectedDirection('across');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (readOnly || data.grid[row][col] === '#') return;

    const newAnswers = [...answers];
    const key = e.key.toUpperCase();

    if (key.match(/^[A-Z]$/)) {
      newAnswers[row][col] = key;
      setAnswers(newAnswers);

      // Mover a la siguiente celda
      if (selectedDirection === 'across') {
        if (col < data.grid[0].length - 1 && data.grid[row][col + 1] !== '#') {
          setSelectedCell([row, col + 1]);
        }
      } else {
        if (row < data.grid.length - 1 && data.grid[row + 1][col] !== '#') {
          setSelectedCell([row + 1, col]);
        }
      }
    } else if (e.key === 'Backspace') {
      newAnswers[row][col] = '';
      setAnswers(newAnswers);

      // Mover a la celda anterior
      if (selectedDirection === 'across') {
        if (col > 0 && data.grid[row][col - 1] !== '#') {
          setSelectedCell([row, col - 1]);
        }
      } else {
        if (row > 0 && data.grid[row - 1][col] !== '#') {
          setSelectedCell([row - 1, col]);
        }
      }
    } else if (e.key === 'ArrowRight' && col < data.grid[0].length - 1) {
      setSelectedCell([row, col + 1]);
      setSelectedDirection('across');
    } else if (e.key === 'ArrowLeft' && col > 0) {
      setSelectedCell([row, col - 1]);
      setSelectedDirection('across');
    } else if (e.key === 'ArrowDown' && row < data.grid.length - 1) {
      setSelectedCell([row + 1, col]);
      setSelectedDirection('down');
    } else if (e.key === 'ArrowUp' && row > 0) {
      setSelectedCell([row - 1, col]);
      setSelectedDirection('down');
    }

    // Verificar si el crucigrama está completo
    const isComplete = data.clues.every(clue => {
      const { row: clueRow, col: clueCol, direction, answer } = clue;
      const userAnswer = direction === 'across'
        ? answers[clueRow].slice(clueCol, clueCol + answer.length).join('')
        : answers.slice(clueRow, clueRow + answer.length).map(r => r[clueCol]).join('');
      return userAnswer === answer;
    });

    if (isComplete) {
      onComplete?.();
    }
  };

  const getClueNumber = (row: number, col: number): number | null => {
    const clue = data.clues.find(c => c.row === row && c.col === col);
    return clue ? clue.number : null;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-1 select-none">
        {data.grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.map((cell, colIndex) => {
              const isSelected = selectedCell?.[0] === rowIndex && selectedCell?.[1] === colIndex;
              const clueNumber = getClueNumber(rowIndex, colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    relative aspect-square flex items-center justify-center
                    ${cell === '#' ? 'bg-black' : 'bg-white border border-gray-300'}
                    ${isSelected ? 'ring-2 ring-blue-500' : ''}
                  `}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                >
                  {cell !== '#' && (
                    <>
                      {clueNumber && (
                        <span className="absolute top-0 left-0 text-xs text-gray-500">
                          {clueNumber}
                        </span>
                      )}
                      <input
                        type="text"
                        maxLength={1}
                        value={answers[rowIndex][colIndex]}
                        onChange={() => {}}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                        className="w-full h-full text-center text-lg font-bold focus:outline-none"
                        readOnly={readOnly}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Horizontal</h3>
          <ol className="space-y-2">
            {data.clues
              .filter(clue => clue.direction === 'across')
              .map((clue) => (
                <li key={clue.number} className="flex gap-2">
                  <span className="font-medium">{clue.number}.</span>
                  <span>{clue.clue}</span>
                </li>
              ))}
          </ol>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Vertical</h3>
          <ol className="space-y-2">
            {data.clues
              .filter(clue => clue.direction === 'down')
              .map((clue) => (
                <li key={clue.number} className="flex gap-2">
                  <span className="font-medium">{clue.number}.</span>
                  <span>{clue.clue}</span>
                </li>
              ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Crossword; 