import { WordSearchData, CrosswordData, WordConnectionData, ConceptMapData, MindMapData, MatchConceptsData } from '../types/activityTypes';

// La configuración de import.meta.env está en src/env.d.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'; // Valor por defecto para desarrollo

// Función auxiliar para validar la respuesta de la API
async function validateApiResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || errorMessage);
  }
  return response.json();
}

// Funciones para actividades
export const generateWordSearch = async (
  pdfId: string
): Promise<WordSearchData> => {
  if (!pdfId) throw new Error('El ID del PDF es requerido');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activities/generate-word-search?pdf_id=${encodeURIComponent(pdfId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await validateApiResponse(response, 'Error al generar la sopa de letras');
    
    // Validar y normalizar la respuesta
    if (!data.words || !Array.isArray(data.words)) {
      throw new Error('La respuesta no contiene palabras válidas');
    }

    if (!data.grid || !Array.isArray(data.grid)) {
      throw new Error('La respuesta no contiene una cuadrícula válida');
    }

    return {
      words: data.words.map(String),
      grid: data.grid,
      solution: data.solution || data.grid
    };
  } catch (error) {
    console.error('Error en generateWordSearch:', error);
    throw error;
  }
};

export const generateCrossword = async (pdfId: string): Promise<CrosswordData> => {
  if (!pdfId) throw new Error('El ID del PDF es requerido');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activities/generate-crossword?pdf_id=${encodeURIComponent(pdfId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await validateApiResponse(response, 'Error al generar el crucigrama');
    
    // Validar y normalizar la respuesta
    if (!data.grid || !Array.isArray(data.grid)) {
      throw new Error('La respuesta no contiene una cuadrícula válida');
    }

    if (!data.clues || !Array.isArray(data.clues)) {
      throw new Error('La respuesta no contiene pistas válidas');
    }

    return {
      grid: data.grid,
      clues: data.clues.map((clue: any) => ({
        number: Number(clue.number) || 0,
        clue: String(clue.clue || ''),
        answer: String(clue.answer || '').toUpperCase(),
        row: Number(clue.row) || 0,
        col: Number(clue.col) || 0,
        direction: clue.direction === 'down' ? 'down' : 'across'
      })),
      solution: data.solution || data.grid
    };
  } catch (error) {
    console.error('Error en generateCrossword:', error);
    throw error;
  }
};

export const generateWordConnection = async (pdfId: string): Promise<WordConnectionData> => {
  if (!pdfId) throw new Error('El ID del PDF es requerido');
  try {
    console.log('Generando conexión de palabras para PDF ID:', pdfId);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_BASE_URL}/api/v1/activities/generate-word-connection?pdf_id=${encodeURIComponent(pdfId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Loggear la respuesta cruda para depuración
    const responseText = await response.text();
    console.log('Respuesta cruda de la API:', responseText);
    
    // Intentar parsear la respuesta
    const data = JSON.parse(responseText);
    console.log('Respuesta de la API parseada:', JSON.stringify(data, null, 2));
    
    if (!data) {
      throw new Error('La respuesta de la API está vacía');
    }

    // Manejar el formato de respuesta que estamos viendo en los logs
    let connections = [];
    let words = [];
    
    if (data.pairs && Array.isArray(data.pairs)) {
      // Extraer palabras y conexiones de pares
      const wordSet = new Set<string>();
      connections = data.pairs.map((pair: any, index: number) => {
        // Mapear los campos de la respuesta real
        const word1 = String(pair.word || pair.term || pair.word1 || `palabra${index + 1}`);
        const word2 = String(pair.concept || pair.definition || pair.word2 || `definición${index + 1}`);
        const connection = pair.description || pair.connection || `Relación entre ${word1} y ${word2}`;
        
        if (word1) wordSet.add(word1);
        if (word2) wordSet.add(word2);
        
        return {
          word1,
          word2,
          connection
        };
      });
      
      words = Array.from(wordSet);
      console.log('Palabras extraídas:', words);
      console.log('Conexiones procesadas:', connections);
    } 
    // Si no hay pares pero tenemos conexiones directas
    else if (data.connections && Array.isArray(data.connections)) {
      const wordSet = new Set<string>();
      connections = data.connections.map((conn: any, index: number) => {
        const word1 = String(conn.word1 || `palabra${index * 2 + 1}`);
        const word2 = String(conn.word2 || `definición${index * 2 + 1}`);
        
        if (word1) wordSet.add(word1);
        if (word2) wordSet.add(word2);
        
        return {
          word1,
          word2,
          connection: conn.connection || `Relación entre ${word1} y ${word2}`
        };
      });
      
      words = Array.from(wordSet);
    }
    // Si recibimos un array plano de palabras y necesitamos crear pares
    else if (Array.isArray(data.words) && data.words.length > 0) {
      words = data.words.map(String);
      // Crear pares simples a partir de las palabras
      connections = [];
      for (let i = 0; i < Math.min(words.length - 1, 8); i += 2) {
        connections.push({
          word1: String(words[i] || ''),
          word2: String(words[i + 1] || ''),
          connection: `Relación ${Math.floor(i/2) + 1}`
        });
      }
    }
    // Si no se pudo procesar la respuesta, lanzar un error con los datos de depuración
    else {
      console.error('Formato de respuesta no reconocido:', data);
      throw new Error(`Formato de respuesta no reconocido: ${JSON.stringify(data, null, 2)}`);
    }

    // Si aún no tenemos conexiones, usar datos de ejemplo
    if (connections.length === 0) {
      console.warn('No se encontraron conexiones en la respuesta, generando datos de ejemplo');
      return {
        words: ['ejemplo1', 'ejemplo2', 'ejemplo3'],
        connections: [
          { word1: 'ejemplo1', word2: 'definición1', connection: 'Relación de ejemplo 1' },
          { word1: 'ejemplo2', word2: 'definición2', connection: 'Relación de ejemplo 2' },
          { word1: 'ejemplo3', word2: 'definición3', connection: 'Relación de ejemplo 3' }
        ]
      };
    }

    // Asegurarse de que todas las palabras sean strings
    const normalizedWords = words.map(String);
    const normalizedConnections = connections.map((conn: { word1: any; word2: any; connection?: string }) => ({
      word1: String(conn.word1),
      word2: String(conn.word2),
      connection: String(conn.connection || `Relación entre ${conn.word1} y ${conn.word2}`)
    }));

    const result = { 
      words: normalizedWords,
      connections: normalizedConnections
    };

    console.log('Conexiones generadas:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error en generateWordConnection:', error);
    
    // Si el error es de parseo JSON, incluir la respuesta original en el error
    if (error instanceof SyntaxError) {
      console.error('Error al parsear la respuesta JSON. Respuesta recibida:', error);
    }
    
    // Devolver datos de ejemplo en caso de error
    return {
      words: ['ejemplo1', 'ejemplo2', 'ejemplo3'],
      connections: [
        { word1: 'ejemplo1', word2: 'definición1', connection: 'Relación de ejemplo 1' },
        { word1: 'ejemplo2', word2: 'definición2', connection: 'Relación de ejemplo 2' },
        { word1: 'ejemplo3', word2: 'definición3', connection: 'Relación de ejemplo 3' }
      ]
    };
  }
};

// Funciones para herramientas
export const generateConceptMap = async (pdfId: string): Promise<ConceptMapData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/tools/generate-concept-map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdfId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || 'Error al generar el mapa conceptual');
    }

    const data = await response.json();
    
    // Validar estructura básica
    if (!data.nodes || !Array.isArray(data.nodes) || !data.edges || !Array.isArray(data.edges)) {
      throw new Error('La respuesta del servidor no tiene el formato esperado');
    }

    return data;
  } catch (error) {
    console.error('Error en generateConceptMap:', error);
    throw error;
  }
};

export const generateMindMap = async (pdfId: string): Promise<MindMapData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/tools/generate-mind-map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdfId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || 'Error al generar el mapa mental');
    }

    const data = await response.json();
    
    // Validar estructura básica
    if (!data.nodes || !Array.isArray(data.nodes) || !data.edges || !Array.isArray(data.edges)) {
      throw new Error('La respuesta del servidor no tiene el formato esperado');
    }

    return data;
  } catch (error) {
    console.error('Error en generateMindMap:', error);
    throw error;
  }
};

export const generateMatchConcepts = async (pdfId: string): Promise<MatchConceptsData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/tools/generate-match-concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfId }),
    });
    if (!response.ok) throw new Error('Error al generar la actividad de asociación');
    return await response.json();
  } catch (error) {
    console.error('Error en generateMatchConcepts:', error);
    throw error;
  }
};

export const aiService = {
  generateWordSearch,
  generateCrossword,
  generateWordConnection,
  generateConceptMap,
  generateMindMap,
  generateMatchConcepts
}; 