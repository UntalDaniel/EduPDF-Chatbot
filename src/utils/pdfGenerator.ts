import { ActivityType, type ActivityTypeActivity } from '../types/activityTypes';

// Configuración común para el PDF
const TITLE_FONT_SIZE = 24;
const SUBTITLE_FONT_SIZE = 18;
const BODY_FONT_SIZE = 12;
const MARGIN = 15;
const LINE_HEIGHT = 7;

// Dimensiones de la página (en mm, tamaño A4)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

// Tamaño máximo de la cuadrícula (mitad de la página)
const MAX_GRID_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MAX_GRID_HEIGHT = (PAGE_HEIGHT - MARGIN * 4) / 2; // Mitad de la página para la cuadrícula

// Tamaño mínimo de celda para buena legibilidad
const MIN_CELL_SIZE = 6;

// Estilos para los números de pista
const CLUE_NUMBER_FONT_SIZE = 6;
const CLUE_NUMBER_OFFSET = 1.5;

/**
 * Genera un archivo PDF a partir de una actividad
 * @param activity - La actividad para generar el PDF
 * @returns Promesa que se resuelve con un Blob del PDF
 */
export const generateActivityPdf = async (activity: ActivityTypeActivity): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  let yPosition = MARGIN;
  
  // Añadir título
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.text(activity.title, MARGIN, yPosition + 20);
  yPosition += 30;
  
  // Añadir descripción si existe
  if (activity.description) {
    doc.setFontSize(BODY_FONT_SIZE);
    const descriptionLines = doc.splitTextToSize(activity.description, 180);
    doc.text(descriptionLines, MARGIN, yPosition);
    yPosition += descriptionLines.length * LINE_HEIGHT + 10;
  }
  
  // Añadir contenido específico según el tipo de actividad
  switch (activity.type) {
    case ActivityType.WORD_SEARCH:
      await generateWordSearchPdf(doc, activity, yPosition);
      break;
    case ActivityType.CROSSWORD:
      await generateCrosswordPdf(doc, activity, yPosition);
      break;
    case ActivityType.WORD_CONNECTION:
      await generateWordConnectionPdf(doc, activity, yPosition);
      break;
  }
  
  return doc.output('blob');
};

// Helper function to get activity data, handling both direct and normalized structures
const getActivityData = (activity: ActivityTypeActivity) => {
  // If activity has a data property, use it directly
  if ('data' in activity) {
    return activity.data;
  }
  
  // Otherwise, assume the activity itself is the data (normalized structure)
  // Exclude common activity properties that shouldn't be part of the data
  const { id, type, title, description, pdfId, createdAt, updatedAt, userId, ...data } = activity as any;
  return data;
};

// Genera el PDF para Sopa de Letras
const generateWordSearchPdf = (
  doc: any,
  activity: ActivityTypeActivity,
  startY: number
) => {
  if (activity.type !== ActivityType.WORD_SEARCH) return;
  
  const activityData = getActivityData(activity);
  let y = startY;
  
  // Título de la sección
  doc.setFontSize(SUBTITLE_FONT_SIZE);
  doc.text('Sopa de Letras', MARGIN, y);
  y += 15;
  
  // Instrucciones
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text('Encuentra las siguientes palabras en la sopa de letras:', MARGIN, y);
  y += 10;
  
  // Lista de palabras a buscar
  if (activityData.words && Array.isArray(activityData.words)) {
    const wordsPerLine = 3;
    let line = '';
    
    activityData.words.forEach((word: string, index: number) => {
      line += (index % wordsPerLine === 0 && index > 0) ? 
        `\n${word}` : 
        `${word}${index % wordsPerLine < wordsPerLine - 1 ? ', ' : ''}`;
    });
    
    const wordLines = doc.splitTextToSize(line, 180);
    doc.text(wordLines, MARGIN + 10, y);
    y += wordLines.length * LINE_HEIGHT + 15;
  }
  
  // Dibujar la cuadrícula de la sopa de letras
  const grid = activityData.grid;
  if (grid && grid.length > 0) {
    const cellSize = 8;
    const startX = MARGIN;
    
    // Dibujar celdas de la cuadrícula
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const x = startX + (j * cellSize);
        const cellY = y + (i * cellSize);
        
        // Dibujar celda
        doc.rect(x, cellY, cellSize, cellSize, 'S');
        
        // Añadir letra
        if (grid[i][j]) {
          doc.text(
            grid[i][j].toUpperCase(), 
            x + (cellSize / 2), 
            cellY + (cellSize / 2) + 1.5, 
            { align: 'center', baseline: 'middle' }
          );
        }
      }
    }
    
    y += (grid.length * cellSize) + 15;
  } else {
    // Si no hay cuadrícula, mostrar un espacio reservado
    doc.setDrawColor(0);
    doc.rect(MARGIN, y, 180, 180, 'S');
    doc.text('Cuadrícula de la sopa de letras', MARGIN + 20, y + 90, { align: 'center' });
    y += 200;
  }
};

// Genera el PDF para Crucigrama
const generateCrosswordPdf = (
  doc: any,
  activity: ActivityTypeActivity,
  startY: number
) => {
  if (activity.type !== ActivityType.CROSSWORD) return startY;
  
  const activityData = getActivityData(activity);
  const clues = activityData.clues || [];
  const grid = activityData.grid || [];
  
  // Título de la sección
  doc.setFontSize(SUBTITLE_FONT_SIZE);
  doc.text('Crucigrama', MARGIN, startY);
  
  // Separar pistas horizontales y verticales
  if (clues.length > 0) {
    const horizontalClues = clues.filter((clue: any) => 
      clue.direction === 'horizontal' || 
      clue.direction === 'across' ||
      (clue.position && clue.position.direction === 'across')
    ).sort((a: any, b: any) => (a.number || 0) - (b.number || 0));
    
    const verticalClues = clues.filter((clue: any) => 
      clue.direction === 'vertical' || 
      clue.direction === 'down' ||
      (clue.position && clue.position.direction === 'down')
    ).sort((a: any, b: any) => (a.number || 0) - (b.number || 0));
    
    // Dibujar la cuadrícula centrada en la mitad superior
    if (grid.length > 0) {
      // Calcular el tamaño de celda máximo posible (mitad de la página)
      const availableWidth = PAGE_WIDTH - MARGIN * 2;
      const availableHeight = (PAGE_HEIGHT - startY) / 2;
      
      const maxCellSizeByWidth = availableWidth / grid[0].length;
      const maxCellSizeByHeight = availableHeight / grid.length;
      
      // Usar el tamaño de celda más pequeño que quepa, con un mínimo de 6mm
      const cellSize = Math.max(6, Math.min(maxCellSizeByWidth, maxCellSizeByHeight));
      
      const gridWidth = cellSize * grid[0].length;
      const gridHeight = cellSize * grid.length;
      
      // Centrar la cuadrícula horizontalmente
      const gridX = MARGIN + (availableWidth - gridWidth) / 2;
      let y = startY + 25; // Espacio después del título
      
      // Dibujar el fondo de la cuadrícula
      doc.setFillColor(255, 255, 255);
      doc.rect(gridX - 1, y - 1, gridWidth + 2, gridHeight + 2, 'F');
      
      // Dibujar el borde exterior
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(gridX, y, gridWidth, gridHeight, 'S');
      
      // Mapa para rastrear las celdas que son inicio de palabra
      const wordStarts = new Map();
      
      // Procesar pistas para marcar inicios de palabras
      const processClues = (clueList: any[], direction: 'across' | 'down') => {
        clueList.forEach((clue: any) => {
          if (clue.position) {
            const { row, col } = clue.position;
            const key = `${row},${col}`;
            
            if (!wordStarts.has(key)) {
              wordStarts.set(key, []);
            }
            wordStarts.get(key).push({ 
              number: clue.number, 
              direction 
            });
          }
        });
      };
      
      // Procesar pistas horizontales y verticales
      processClues(horizontalClues, 'across');
      processClues(verticalClues, 'down');
      
      // Dibujar celdas y números de pista
      doc.setFontSize(6); // Tamaño pequeño para los números
      doc.setTextColor(0, 0, 0);
      
      for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
          const cellX = gridX + j * cellSize;
          const cellY = y + i * cellSize;
          
          // Dibujar celda negra si es necesario
          if (grid[i][j] === ' ' || grid[i][j] === '.') {
            doc.setFillColor(0, 0, 0);
            doc.rect(cellX, cellY, cellSize, cellSize, 'F');
          } else {
            // Verificar si esta celda es el inicio de una palabra
            const key = `${i},${j}`;
            if (wordStarts.has(key)) {
              const starts = wordStarts.get(key);
              // Mostrar números de pista en la esquina superior izquierda
              starts.forEach((start: any, index: number) => {
                doc.text(
                  start.number.toString(),
                  cellX + 1 + (index * 3.5),
                  cellY + 2.5
                );
              });
            }
          }
          
          // Dibujar líneas de la cuadrícula
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.1);
          doc.rect(cellX, cellY, cellSize, cellSize, 'S');
        }
      }
      
      // Dibujar bordes de palabras
      const drawWordBorders = (clueList: any[], direction: 'horizontal' | 'vertical') => {
        doc.setLineWidth(0.3);
        
        clueList.forEach((clue: any) => {
          if (clue.position) {
            const { row, col } = clue.position;
            const wordLength = clue.answer?.length || 0;
            
            if (direction === 'horizontal') {
              doc.setDrawColor(65, 105, 225); // Azul para horizontales
              doc.rect(
                gridX + col * cellSize, 
                y + row * cellSize, 
                cellSize * wordLength, 
                cellSize, 
                'S'
              );
            } else {
              doc.setDrawColor(220, 20, 60); // Rojo para verticales
              doc.rect(
                gridX + col * cellSize, 
                y + row * cellSize, 
                cellSize, 
                cellSize * wordLength, 
                'S'
              );
            }
          }
        });
      };
      
      // Dibujar bordes de palabras horizontales y verticales
      drawWordBorders(horizontalClues, 'horizontal');
      drawWordBorders(verticalClues, 'vertical');
      
      // Mover el cursor debajo de la cuadrícula para las pistas
      y += gridHeight + 15;
      
      // Dibujar pistas horizontales
      if (horizontalClues.length > 0) {
        doc.setFontSize(SUBTITLE_FONT_SIZE - 2);
        doc.setFont('helvetica', 'bold');
        doc.text('HORIZONTALES', MARGIN, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
        
        doc.setFontSize(BODY_FONT_SIZE - 1);
        horizontalClues.forEach((clue: any) => {
          const text = `${clue.number}. ${clue.clue || 'Sin pista'}`;
          const lines = doc.splitTextToSize(text, PAGE_WIDTH - MARGIN * 2 - 10);
          doc.text(lines, MARGIN + 5, y);
          y += lines.length * 5 + 2;
        });
        
        y += 5; // Espacio antes de las pistas verticales
      }
      
      // Dibujar pistas verticales
      if (verticalClues.length > 0) {
        doc.setFontSize(SUBTITLE_FONT_SIZE - 2);
        doc.setFont('helvetica', 'bold');
        doc.text('VERTICALES', MARGIN, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
        
        doc.setFontSize(BODY_FONT_SIZE - 1);
        verticalClues.forEach((clue: any) => {
          const text = `${clue.number}. ${clue.clue || 'Sin pista'}`;
          const lines = doc.splitTextToSize(text, PAGE_WIDTH - MARGIN * 2 - 10);
          doc.text(lines, MARGIN + 5, y);
          y += lines.length * 5 + 2;
        });
      }
      
      return y;
    } else {
      // Si no hay cuadrícula, mostrar un mensaje
      doc.setFontSize(BODY_FONT_SIZE);
      doc.text('No hay cuadrícula disponible para este crucigrama.', MARGIN, startY + 20);
      return startY + 30;
    }
  }
  
  return startY + 30;
};

// Genera el PDF para Conexión de Palabras
const generateWordConnectionPdf = (
  doc: any,
  activity: ActivityTypeActivity,
  startY: number
) => {
  if (activity.type !== ActivityType.WORD_CONNECTION) return startY;
  
  const activityData = getActivityData(activity);
  let y = startY;
  
  // Título de la sección
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.text('Actividad: Conexión de Palabras', MARGIN, y);
  y += 10;
  
  // Instrucciones
  doc.setFontSize(BODY_FONT_SIZE);
  const instructions = [
    'Instrucciones: Conecta cada palabra con su definición correspondiente.',
    'Escribe el número de la definición en el espacio provisto al lado de cada palabra.'
  ];
  
  instructions.forEach(instruction => {
    doc.text(instruction, MARGIN, y);
    y += 7;
  });
  
  y += 10; // Espacio después de las instrucciones
  
  // Lista de palabras y definiciones
  if (activityData.words && activityData.connections && activityData.words.length > 0) {
    const words = activityData.words;
    const connections = activityData.connections;
    
    // Configuración del diseño
    const colWidth = (PAGE_WIDTH - (MARGIN * 3)) / 2; // Ancho de cada columna
    const boxHeight = 12; // Altura de cada caja
    const boxMargin = 5; // Margen entre cajas
    const startX = MARGIN;
    
    // Dibujar encabezados de columnas
    doc.setFont(undefined, 'bold');
    doc.text('Palabras', startX, y);
    doc.text('Definiciones', startX + colWidth + MARGIN, y);
    y += 8;
    
    // Dibujar línea separadora de encabezados
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(startX, y, startX + (colWidth * 2) + MARGIN, y);
    y += 5;
    
    // Primero mostramos todas las palabras en la columna izquierda
    words.forEach((word: string, index: number) => {
      // Si no hay espacio suficiente en la página, crear una nueva
      if (y + boxHeight > PAGE_HEIGHT - MARGIN * 2) {
        doc.addPage();
        y = MARGIN;
      }
      
      // Dibujar caja de palabra (izquierda)
      doc.setDrawColor(0);
      doc.setFillColor(240, 240, 240); // Fondo gris claro
      doc.rect(startX, y, colWidth, boxHeight, 'FD'); // FD = Fill and Draw
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.text(word, startX + 3, y + boxHeight / 2 + 2);
      
      // Cuadro pequeño para escribir el número de la definición
      doc.setDrawColor(0);
      doc.rect(startX + colWidth - 15, y + 2, 12, 8, 'S');
      
      y += boxHeight + boxMargin;
    });
    
    // Volvemos a la posición inicial después de las palabras
    y = startY + 45; // Ajustar según sea necesario
    
    // Luego mostramos las definiciones en la columna derecha
    connections.forEach((conn: any, index: number) => {
      const definition = conn.connection || conn.word2 || '';
      
      // Si no hay espacio suficiente en la página, crear una nueva
      if (y + boxHeight > PAGE_HEIGHT - MARGIN * 2) {
        doc.addPage();
        y = MARGIN;
      }
      
      // Dibujar caja de definición (derecha)
      doc.setDrawColor(0);
      doc.setFillColor(255, 255, 255); // Fondo blanco
      doc.rect(startX + colWidth + MARGIN, y, colWidth, boxHeight, 'FD');
      doc.text(`${index + 1}. ${definition}`, startX + colWidth + MARGIN + 3, y + boxHeight / 2 + 2);
      
      y += boxHeight + boxMargin;
    });
    
    // Añadir sección para escribir las respuestas
    y += 15;
    doc.setFont(undefined, 'bold');
    doc.text('Respuestas:', MARGIN, y);
    y += 8;
    doc.setFont(undefined, 'normal');
    
    // Cuadrícula para escribir las respuestas
    const answerCols = 3;
    const answerBoxWidth = colWidth / 2;
    const answerBoxHeight = 8;
    const answersPerRow = Math.floor((PAGE_WIDTH - MARGIN * 2) / answerBoxWidth);
    
    // Dibujar encabezados de la tabla de respuestas
    doc.setFont(undefined, 'bold');
    doc.text('N°', MARGIN, y + 5);
    doc.text('Palabra', MARGIN + 20, y + 5);
    doc.text('Definición', MARGIN + 80, y + 5);
    doc.line(MARGIN, y + 7, PAGE_WIDTH - MARGIN, y + 7);
    y += 12;
    
    // Filas de la tabla de respuestas
    doc.setFont(undefined, 'normal');
    connections.forEach((conn: any, index: number) => {
      const row = Math.floor(index / answerCols);
      const col = index % answerCols;
      const x = MARGIN + (col * (answerBoxWidth * 2 + 10));
      const currentY = y + (row * (answerBoxHeight + 5));
      
      // Si no hay espacio, crear nueva página
      if (currentY + answerBoxHeight > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      
      // Número
      doc.text(`${index + 1}.`, x, currentY + 5);
      
      // Línea para escribir la respuesta
      doc.setDrawColor(200);
      doc.line(x + 15, currentY + 5, x + 60, currentY + 5);
      
      // Línea para escribir el número de definición
      doc.rect(x + 70, currentY, 30, answerBoxHeight, 'S');
    });
  }
  
  return y + 20; // Devolver la posición Y final
};
