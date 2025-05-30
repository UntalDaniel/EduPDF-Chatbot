import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { ActivityType } from '../../types/activityTypes';
import type { ActivityTypeActivity, CrosswordData, WordConnectionData } from '../../types/activityTypes';

// Tipos para las props de renderizado de página
type PageNumberProps = {
  pageNumber: number;
  totalPages: number;
};

// Usamos las fuentes predeterminadas de react-pdf
// No es necesario registrar fuentes adicionales para la generación básica de PDF

// PDF styles
const styles = StyleSheet.create({
  // Layout
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    position: 'relative',
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
  },
  grid: {
    border: '1px solid #000',
    margin: '0 auto',
    maxWidth: '100%',
  },
  // Header & Title
  header: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1px solid #eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 5,
  },

  // Grid & Cell
  cell: {
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  // Instructions
  instructions: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f7fafc',
    borderLeft: '3px solid #4299e1',
    borderRadius: 4,
  },
  instructionsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#2d3748',
  },
  instructionItem: {
    fontSize: 9,
    marginBottom: 2,
    color: '#4a5568',
  },

  // Footer & Page Number
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 9,
    color: '#a0aec0',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#a0aec0',
  },

  // Crossword Clues
  clueHeader: {
    fontWeight: 'bold',
    fontSize: 10,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottom: '1px solid #ddd',
    textTransform: 'uppercase',
    color: '#2c3e50',
  },
  clueItem: {
    flexDirection: 'row',
    marginBottom: 4,
    fontSize: 9,
    lineHeight: 1.3,
  },
  clueNumber: {
    fontWeight: 'bold',
    marginRight: 4,
    minWidth: 15,
    fontSize: 9,
  },
  clueText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.3,
  },
  wordList: {
    marginTop: 15,
  },
  wordItem: {
    fontSize: 9,
    marginBottom: 6,
    lineHeight: 1.3,
  },
  connectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wordColumn: {
    width: '48%',
  },
  wordPair: {
    marginBottom: 6,
  },
  word: {
    fontSize: 9,
    marginBottom: 2,
  },
  // Answer Section
  answerSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTop: '1px solid #e2e8f0',
  },
  answerRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  answerLabel: {
    width: 100,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 2,
  },
  answerLine: {
    flex: 1,
    borderBottom: '1px solid #cbd5e0',
    height: 16,
    marginLeft: 8,
    marginTop: 10,
  },
  item: {
    padding: '6px 8px',
    marginBottom: 6,
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    fontSize: 10,
  },
  column: {
    width: '48%',
    padding: 5,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#2c3e50',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
  },
});

// Component to render Word Search activity
const WordSearchPDF: React.FC<{ data: { grid: string[][]; words: string[] } }> = ({ data }) => (
  <View style={styles.section}>
    <View style={styles.grid}>
      {data.grid.map((row: string[], rowIndex: number) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, cellIndex) => (
            <View key={`${rowIndex}-${cellIndex}`} style={styles.cell}>
              <Text>{cell || ''}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
    <View style={styles.wordList}>
      <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Palabras a encontrar:</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.words.map((word: string, index: number) => (
          <Text key={index} style={{ width: '33%', marginBottom: 5 }}>
            • {word}
          </Text>
        ))}
      </View>
    </View>
  </View>
);



// Helper function to find if a cell is the start of a word
// Removed as it's no longer needed - using cellNumbers map instead

// Component to render Crossword activity
const CrosswordPDF: React.FC<{ data: CrosswordData }> = ({ data }) => {
  if (!data || !data.clues || !Array.isArray(data.clues)) {
    return (
      <View style={{ padding: 10 }}>
        <Text style={{ color: 'red' }}>Error: Datos del crucigrama no válidos</Text>
      </View>
    );
  }
  
  // Group clues by direction with proper type assertion
  const acrossClues = data.clues.filter((clue): clue is { number: number; direction: 'across'; clue: string; answer: string } => 
    clue && clue.direction === 'across'
  );
  const downClues = data.clues.filter((clue): clue is { number: number; direction: 'down'; clue: string; answer: string } => 
    clue && clue.direction === 'down'
  );

  // Create a map of cell numbers
  const cellNumbers: {[key: string]: number} = {};
  let currentNumber = 1;
  
  for (let r = 0; r < data.grid.length; r++) {
    for (let c = 0; c < data.grid[r].length; c++) {
      if (data.grid[r][c] !== ' ' && (
        (c === 0 || data.grid[r][c - 1] === ' ') || 
        (r === 0 || data.grid[r - 1][c] === ' ')
      )) {
        cellNumbers[`${r}-${c}`] = currentNumber++;
      }
    }
  }

  return (
    <View style={styles.section}>
      <View style={[styles.grid, { marginBottom: 20 }]}>
        {data.grid.map((row: string[], rowIndex: number) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, cellIndex) => {
              const isBlack = cell === ' ';
              const cellNumber = cellNumbers[`${rowIndex}-${cellIndex}`];
              const showNumber = cellNumber !== undefined;
              
              return (
                <View 
                  key={`${rowIndex}-${cellIndex}`} 
                  style={[styles.cell, { 
                    backgroundColor: isBlack ? '#000' : '#fff',
                    border: '1px solid #ccc',
                    position: 'relative',
                  }]}
                >
                  {showNumber && (
                    <Text style={{
                      position: 'absolute',
                      top: 1,
                      left: 1,
                      fontSize: 6,
                      lineHeight: 1,
                      padding: '1px 2px 0 0',
                    }}>
                      {cellNumber}
                    </Text>
                  )}
                  <Text style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    marginTop: showNumber ? 5 : 0,
                  }}>
                    {isBlack ? '' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.clueHeader}>HORIZONTALES</Text>
          {acrossClues.map((clue) => (
            <View key={`across-${clue.number}`} style={styles.clueItem}>
              <Text style={styles.clueNumber}>{clue.number}.</Text>
              <Text style={styles.clueText}>{clue.clue} ({clue.answer.length})</Text>
            </View>
          ))}
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.clueHeader}>VERTICALES</Text>
          {downClues.map((clue) => (
            <View key={`down-${clue.number}`} style={styles.clueItem}>
              <Text style={styles.clueNumber}>{clue.number}.</Text>
              <Text style={styles.clueText}>{clue.clue} ({clue.answer.length})</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// Component to render Word Connection activity
const WordConnectionPDF: React.FC<{ data: WordConnectionData }> = ({ data }) => {
  // Process word-definition pairs
  let pairs: Array<{word: string, definition: string, id: number}> = [];

  // Handle direct connections (from connections array)
  if (data.connections?.length) {
    pairs = data.connections.map((conn, index) => ({
      id: index + 1,
      word: String(conn.word1 || '').trim(),
      definition: String(conn.connection || conn.word2 || '').trim()
    }));
  } 
  // Handle pairs from data.pairs
  else if (data.pairs?.length) {
    pairs = data.pairs.map((pair, index) => ({
      id: index + 1,
      word: String(pair.term || '').trim(),
      definition: String(pair.definition || pair.description || '').trim()
    }));
  }

  // Shuffle definitions
  const shuffledDefs = [...pairs]
    .sort(() => Math.random() - 0.5)
    .map((pair, index) => ({
      id: pair.id,
      text: pair.definition,
      letter: String.fromCharCode(65 + index)
    }));

  // Assign letters to words
  const wordLetters = pairs.map((_, index) => (index + 1).toString());
  const defLetters = pairs.map((_, i) => String.fromCharCode(65 + i));

  return (
    <View style={styles.section}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Conexión de Palabras</Text>
        <Text style={styles.subtitle}>Nombre: ___________________________ Fecha: _______________</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Instrucciones:</Text>
        <Text style={styles.instructionItem}>• Conecta cada palabra con su definición correspondiente</Text>
        <Text style={styles.instructionItem}>• Escribe el número de la palabra al lado de su definición</Text>
      </View>

      {/* Content */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
        {/* Words Column */}
        <View style={{ width: '48%' }}>
          <View style={{ borderBottomWidth: 1, marginBottom: 8, paddingBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 12 }}>PALABRAS</Text>
          </View>
          {pairs.map((item, index) => (
            <View key={`word-${item.id}`} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'center' }}>
              <Text style={{ width: 20, textAlign: 'right', marginRight: 8, fontSize: 10, fontWeight: 'bold' }}>
                {wordLetters[index]}.
              </Text>
              <View style={{ 
                borderWidth: 1, 
                borderColor: '#000', 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 4,
                flex: 1
              }}>
                <Text style={{ fontSize: 10 }}>{item.word}</Text>
              </View>
            </View>
          ))}
        </View>
        
        {/* Definitions Column */}
        <View style={{ width: '48%' }}>
          <View style={{ borderBottomWidth: 1, marginBottom: 8, paddingBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 12 }}>DEFINICIONES</Text>
          </View>
          {shuffledDefs.map((def, index) => (
            <View key={`def-${def.id}`} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'center' }}>
              <Text style={{ width: 20, textAlign: 'right', marginRight: 8, fontSize: 10, fontWeight: 'bold' }}>
                {String.fromCharCode(65 + index)}.
              </Text>
              <View style={{ 
                borderWidth: 1, 
                borderColor: '#000', 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 4,
                flex: 1
              }}>
                <Text style={{ fontSize: 10 }}>{def.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      
      {/* Answer Key removed as per user request */}
    </View>
  );
};

// Function to normalize activity data
const normalizeActivityData = (activity: ActivityTypeActivity) => {
  // If activity already has the expected structure, return it
  if ('data' in activity && activity.data) {
    return activity;
  }
  
  // If not, assume properties are at the root level (for backward compatibility)
  const { id, type, title, description, pdfId, createdAt, updatedAt, userId, ...data } = activity as any;
  
  // Create a new activity object with the data properly nested
  return {
    ...activity,
    data: data as any
  };
};

// Main PDF component
export const ActivityPDF: React.FC<{ activity: ActivityTypeActivity }> = ({ activity }) => {
  // Normalize activity data
  const normalizedActivity = React.useMemo(() => normalizeActivityData(activity), [activity]);

  const renderActivityContent = () => {
    if (!normalizedActivity.data) {
      return (
        <View style={{ padding: 10 }}>
          <Text style={{ color: 'red' }}>Error: No se encontraron datos de la actividad</Text>
        </View>
      );
    }

    switch (normalizedActivity.type) {
      case ActivityType.WORD_SEARCH:
        return (
          <>
            <WordSearchPDF data={normalizedActivity.data} />
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>Instrucciones:</Text>
              <Text style={styles.instructionItem}>• Encuentra las palabras listadas en la sopa de letras</Text>
              <Text style={styles.instructionItem}>• Las palabras pueden estar en horizontal, vertical o diagonal</Text>
              <Text style={styles.instructionItem}>• Las palabras pueden estar escritas en cualquier dirección</Text>
            </View>
          </>
        );
        
      case ActivityType.CROSSWORD:
        return (
          <>
            <CrosswordPDF data={normalizedActivity.data} />
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>Instrucciones:</Text>
              <Text style={styles.instructionItem}>• Completa el crucigrama usando las pistas proporcionadas</Text>
              <Text style={styles.instructionItem}>• Las pistas están divididas en horizontales y verticales</Text>
              <Text style={styles.instructionItem}>• Cada número corresponde a una casilla en el crucigrama</Text>
            </View>
          </>
        );
        
      case ActivityType.WORD_CONNECTION:
        return (
          <>
            <WordConnectionPDF data={normalizedActivity.data} />
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>Instrucciones:</Text>
              <Text style={styles.instructionItem}>• Escribe el número de la definición que corresponde a cada palabra</Text>
              <Text style={styles.instructionItem}>• Usa los espacios en blanco para anotar tus respuestas</Text>
              <Text style={styles.instructionItem}>• Verifica que cada palabra esté correctamente emparejada</Text>
            </View>
          </>
        );
        
      default:
        return (
          <View style={{ padding: 10 }}>
            <Text style={{ color: 'red' }}>Tipo de actividad no soportado</Text>
          </View>
        );
    }
  };

  // Componente para el número de página
  const PageNumber = ({ pageNumber, totalPages }: PageNumberProps) => (
    <Text style={styles.pageNumber}>
      Página {pageNumber} de {totalPages}
    </Text>
  );

  // Usamos un array de páginas para manejar el paginado
  const pages = [
    <Page key={1} size="A4" style={styles.page}>
      {/* Header with title and description */}
      <View style={styles.header}>
        <Text style={styles.title}>{normalizedActivity.title}</Text>
        {normalizedActivity.description && (
          <Text style={styles.subtitle}>{normalizedActivity.description}</Text>
        )}
      </View>

      {/* Main activity content */}
      <View style={styles.section}>
        {renderActivityContent()}
      </View>

      {/* Footer with page number */}
      <View style={styles.footer}>
        <PageNumber pageNumber={1} totalPages={1} />
      </View>
    </Page>
  ];

  return <Document>{pages}</Document>;
};

// PDF viewer component
export const PrintableView: React.FC<{ activity: ActivityTypeActivity }> = ({ activity }) => {
  const [pdfUrl, setPdfUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    const generatePdf = async () => {
      try {
        const blob = await pdf(<ActivityPDF activity={activity} />).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Error generating PDF:', error);
      } finally {
        setLoading(false);
      }
    };

    generatePdf();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [activity]);

  if (loading) {
    return <div style={{ padding: '20px' }}>Generando PDF...</div>;
  }

  return (
    <div style={{ width: '100%', height: '80vh' }}>
      <iframe
        src={pdfUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Vista previa del PDF"
      />
    </div>
  );
};

// No default export needed - using named export
