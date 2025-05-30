import React from 'react';
import { CrosswordData } from '../../types/activityTypes';

interface CrosswordProps {
  data: CrosswordData;
}

// Utilidad para asegurar que grid sea string[][]
function ensureGridIs2DArray(grid: any): string[][] {
  if (!Array.isArray(grid)) return [];
  if (grid.length === 0) return [];
  if (Array.isArray(grid[0])) {
    return grid as string[][];
  } else if (typeof grid[0] === 'string') {
    return (grid as string[]).map(row => row.split(''));
  }
  return [];
}

export const Crossword: React.FC<CrosswordProps> = ({ data }) => {
  // Asegurar que clues es un array
  const clues = Array.isArray((data as any).clues) ? (data as any).clues : [];
  const horizontalClues = clues.filter((c: any) => c.direction === 'across');
  const verticalClues = clues.filter((c: any) => c.direction === 'down');

  // Adaptar la matriz de forma robusta
  const grid: string[][] = ensureGridIs2DArray(data.grid);
  const gridColumns = grid.length > 0 ? grid[0].length : 0;

  if (!grid || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    return (
      <div className="text-center text-red-500 p-4">
        No se pudo generar la cuadrícula del crucigrama.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Cuadrícula del crucigrama */}
      <div className="overflow-x-auto mb-6">
        <div 
          className="grid gap-px bg-gray-300 p-1 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            maxWidth: '100%',
            width: 'fit-content'
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              // Buscar si hay una pista que inicia en esta celda
              const clue = clues.find((c: any) => c.row === rowIndex && c.col === colIndex);
              
              if (cell === '#' || cell === '.') {
                return (
                  <div 
                    key={`${rowIndex}-${colIndex}`} 
                    className="bg-gray-800"
                    style={{
                      aspectRatio: '1/1',
                      minWidth: '28px',
                      minHeight: '28px'
                    }}
                  />
                );
              }
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="relative bg-white flex items-center justify-center"
                  style={{
                    aspectRatio: '1/1',
                    minWidth: '28px',
                    minHeight: '28px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  {clue && (
                    <span 
                      className="absolute top-0 left-0 text-[8px] font-bold p-0.5 text-gray-700 leading-none"
                      style={{ lineHeight: 1 }}
                    >
                      {clue.number}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pistas */}
      {clues.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Pistas:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Horizontal</h4>
              <ul className="space-y-2">
                {horizontalClues.map((clue: any) => (
                  <li key={`across-${clue.number}`} className="text-sm">
                    <span className="font-medium text-gray-900">{clue.number}.</span>{' '}
                    <span className="text-gray-700">{clue.clue}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Vertical</h4>
              <ul className="space-y-2">
                {verticalClues.map((clue: any) => (
                  <li key={`down-${clue.number}`} className="text-sm">
                    <span className="font-medium text-gray-900">{clue.number}.</span>{' '}
                    <span className="text-gray-700">{clue.clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 