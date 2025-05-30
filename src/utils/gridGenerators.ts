import { WordSearchDirection, CrosswordClue, CrosswordData } from '../types/activityTypes';

// Función para generar letras aleatorias en español
const getRandomLetter = (): string => {
  const letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  return letters[Math.floor(Math.random() * letters.length)];
};

// Función principal para generar la sopa de letras
export const generateWordSearchGrid = (
  words: string[],
  directions: WordSearchDirection[] = ['horizontal', 'vertical']
): string[][] => {
  const size = Math.max(15, Math.ceil(Math.sqrt(words.length * 8)));
  const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));

  // Función para verificar si una palabra puede colocarse en una posición
  const canPlaceWord = (word: string, row: number, col: number, direction: WordSearchDirection): boolean => {
    const len = word.length;
    if (direction === 'horizontal' && col + len > size) return false;
    if (direction === 'vertical' && row + len > size) return false;
    if (direction === 'diagonal' && (col + len > size || row + len > size)) return false;

    for (let i = 0; i < len; i++) {
      let r = row;
      let c = col;
      if (direction === 'horizontal') c += i;
      else if (direction === 'vertical') r += i;
      else {
        r += i;
        c += i;
      }

      if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
    }
    return true;
  };

  // Función para colocar una palabra en la cuadrícula
  const placeWord = (word: string, row: number, col: number, direction: WordSearchDirection): void => {
    const len = word.length;
    for (let i = 0; i < len; i++) {
      let r = row;
      let c = col;
      if (direction === 'horizontal') c += i;
      else if (direction === 'vertical') r += i;
      else {
        r += i;
        c += i;
      }
      grid[r][c] = word[i];
    }
  };

  // Intentar colocar cada palabra
  for (const word of words) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!placed && attempts < maxAttempts) {
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      if (canPlaceWord(word, row, col, direction)) {
        placeWord(word, row, col, direction);
        placed = true;
      }
      attempts++;
    }

    if (!placed) {
      console.warn(`No se pudo colocar la palabra: ${word}`);
    }
  }

  // Llenar espacios vacíos con letras aleatorias
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (grid[i][j] === '') {
        grid[i][j] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return grid;
};

export const generateCrosswordGrid = (clues: { clue: string; answer: string }[]): CrosswordData => {
  const size = Math.max(15, Math.ceil(Math.sqrt(clues.length * 8)));
  const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));

  // Ordenar palabras por longitud (más largas primero)
  const sortedClues = [...clues].sort((a, b) => b.answer.length - a.answer.length);

  // Función para verificar si una palabra puede colocarse en una posición
  const canPlaceWord = (word: string, row: number, col: number, direction: 'across' | 'down'): boolean => {
    const len = word.length;
    if (direction === 'across' && col + len > size) return false;
    if (direction === 'down' && row + len > size) return false;

    for (let i = 0; i < len; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
      // Verificar que no haya letras adyacentes (excepto en intersecciones)
      if (direction === 'across') {
        if (row > 0 && grid[row - 1][c] !== '') return false;
        if (row < size - 1 && grid[row + 1][c] !== '') return false;
        if (i === 0 && col > 0 && grid[r][col - 1] !== '') return false;
        if (i === len - 1 && col + len < size && grid[r][col + len] !== '') return false;
      } else {
        if (col > 0 && grid[r][col - 1] !== '') return false;
        if (col < size - 1 && grid[r][col + 1] !== '') return false;
        if (i === 0 && row > 0 && grid[row - 1][c] !== '') return false;
        if (i === len - 1 && row + len < size && grid[row + len][c] !== '') return false;
      }
    }
    return true;
  };

  // Función para colocar una palabra en la cuadrícula
  const placeWord = (word: string, row: number, col: number, direction: 'across' | 'down'): void => {
    const len = word.length;
    for (let i = 0; i < len; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      grid[r][c] = word[i];
    }
  };

  // Colocar la primera palabra en el centro
  const firstWord = sortedClues[0].answer.toUpperCase();
  const firstRow = Math.floor(size / 2);
  const firstCol = Math.floor((size - firstWord.length) / 2);
  placeWord(firstWord, firstRow, firstCol, 'across');
  const placed: CrosswordClue[] = [{
    number: 1,
    clue: sortedClues[0].clue,
    answer: firstWord,
    row: firstRow,
    col: firstCol,
    direction: 'across',
  }];
  let number = 2;

  // Intentar colocar el resto de las palabras
  for (let i = 1; i < sortedClues.length; i++) {
    const clue = sortedClues[i];
    const word = clue.answer.toUpperCase();
    let placedFlag = false;
    let attempts = 0;
    const maxAttempts = 100;
    while (!placedFlag && attempts < maxAttempts) {
      const direction: 'across' | 'down' = attempts % 2 === 0 ? 'across' : 'down';
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      if (canPlaceWord(word, row, col, direction)) {
        placeWord(word, row, col, direction);
        placed.push({
          number,
          clue: clue.clue,
          answer: word,
          row,
          col,
          direction,
        });
        number++;
        placedFlag = true;
      }
      attempts++;
    }
    if (!placedFlag) {
      // Si no se pudo colocar, se omite
      // Opcional: podrías agregar feedback aquí
    }
  }

  // Llenar espacios vacíos con '#'
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (grid[i][j] === '') {
        grid[i][j] = '#';
      }
    }
  }

  // Solución: igual que grid pero sin '#'
  const solution = grid.map(row => row.map(cell => (cell === '#' ? '' : cell)));

  return {
    grid,
    clues: placed,
    solution,
  };
}; 