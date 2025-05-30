import React from 'react';
import type { WordSearchData } from '../../types/activityTypes';

interface WordSearchProps {
  data?: WordSearchData;
}

// Utilidad para asegurar que grid sea string[][]
function ensureGridIs2DArray(grid: any): string[][] {
  if (!grid) return [];
  if (!Array.isArray(grid)) {
    console.error('El grid no es un array:', grid);
    return [];
  }
  if (grid.length === 0) return [];
  
  // Si el primer elemento es un array, asumimos que ya es string[][]
  if (Array.isArray(grid[0])) {
    return grid as string[][];
  }
  
  // Si el primer elemento es un string, asumimos que es string[] y lo convertimos a string[][]
  if (typeof grid[0] === 'string') {
    return (grid as string[]).map(row => 
      typeof row === 'string' ? row.split('') : []
    );
  }
  
  console.error('Formato de grid no soportado:', grid);
  return [];
}

export const WordSearch: React.FC<WordSearchProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center text-red-500 p-4">
        Error: No se recibieron datos para la sopa de letras.
      </div>
    );
  }

  if (!data.grid) {
    console.error('Datos de la sopa de letras sin grid:', data);
    return (
      <div className="text-center text-red-500 p-4">
        Error: La estructura de datos de la sopa de letras es incorrecta.
      </div>
    );
  }

  // Adaptar la matriz de forma robusta
  const grid: string[][] = ensureGridIs2DArray(data.grid);

  if (!grid || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    console.error('No se pudo generar la matriz de la sopa de letras. Datos recibidos:', data);
    return (
      <div className="text-center text-red-500 p-4">
        No se pudo generar la matriz de la sopa de letras. Por favor, verifica los datos.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <div 
          className="grid gap-px bg-gray-200 p-1 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`,
            maxWidth: '100%',
            width: 'fit-content'
          }}
        >
          {grid.map((row: string[], rowIndex: number) =>
            row.map((cell: string, colIndex: number) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center bg-white text-gray-900 font-mono"
                style={{
                  aspectRatio: '1/1',
                  minWidth: '28px',
                  minHeight: '28px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  lineHeight: 1,
                }}
              >
                {cell.toUpperCase()}
              </div>
            ))
          )}
        </div>
      </div>
      
      {data.words && data.words.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Palabras a encontrar:</h3>
          <div className="flex flex-wrap gap-2">
            {data.words.map((word: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-800 rounded-full"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 