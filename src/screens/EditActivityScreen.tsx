import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle, Save } from 'lucide-react';
import { getActivity, updateActivity } from '../firebase/activityService';
import { useAuth } from '../hooks';
import { ActivityType } from '../types/activityTypes';
import type { ActivityTypeActivity, WordSearchActivity, CrosswordActivity, WordConnectionActivity } from '../types/activityTypes';
import { generateWordSearchGrid, generateCrosswordGrid } from '../utils/gridGenerators';

const EditActivityScreen: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityTypeActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para el formulario
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wordSearchWords, setWordSearchWords] = useState<{ word: string; hint: string }[]>([]);
  const [crosswordClues, setCrosswordClues] = useState<{ clue: string; answer: string }[]>([]);
  const [wordConnections, setWordConnections] = useState<{ word1: string; word2: string; connection: string }[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!activityId) {
        setError('No se proporcionó un ID de actividad');
        setLoading(false);
        return;
      }

      try {
        const activityData = await getActivity(activityId);
        if (activityData) {
          setActivity(activityData);
          setTitle(activityData.title);
          setDescription(activityData.description);

          // Cargar datos específicos según el tipo de actividad
          if (activityData.type === ActivityType.WORD_SEARCH) {
            setWordSearchWords(activityData.data.words.map(w => ({ word: w.word, hint: w.hint })));
          } else if (activityData.type === ActivityType.CROSSWORD) {
            setCrosswordClues(activityData.data.clues.map(c => ({ clue: c.clue, answer: c.answer })));
          } else if (activityData.type === ActivityType.WORD_CONNECTION) {
            setWordConnections(activityData.data.connections);
          }
        } else {
          setError('Actividad no encontrada');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la actividad');
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [activityId]);

  const handleSave = async () => {
    if (!activity || !user || !activityId) return;

    setIsSaving(true);
    setError(null);

    try {
      let updatedActivity: ActivityTypeActivity;

      switch (activity.type) {
        case ActivityType.WORD_SEARCH:
          const wordSearchGrid = generateWordSearchGrid(
            wordSearchWords.map(w => w.word.toUpperCase()),
            ['horizontal', 'vertical', 'diagonal']
          );
          updatedActivity = {
            ...activity,
            title,
            description,
            data: {
              grid: wordSearchGrid,
              words: wordSearchWords.map(w => ({ ...w, found: false }))
            }
          } as WordSearchActivity;
          break;

        case ActivityType.CROSSWORD:
          const { grid: crosswordGrid, clues: crosswordCluesWithPositions } = generateCrosswordGrid(
            crosswordClues.map(c => ({
              clue: c.clue,
              answer: c.answer.toUpperCase()
            }))
          );
          updatedActivity = {
            ...activity,
            title,
            description,
            data: {
              grid: crosswordGrid,
              clues: crosswordCluesWithPositions.map(clue => ({
                clue: clue.clue,
                answer: clue.answer,
                position: {
                  row: clue.position?.row || 0,
                  col: clue.position?.col || 0,
                  direction: clue.position?.direction === 'horizontal' ? 'across' : 'down'
                }
              }))
            }
          } as CrosswordActivity;
          break;

        case ActivityType.WORD_CONNECTION:
          updatedActivity = {
            ...activity,
            title,
            description,
            data: {
              connections: wordConnections
            }
          } as WordConnectionActivity;
          break;

        default:
          throw new Error('Tipo de actividad no válido');
      }

      await updateActivity(activityId, updatedActivity);
      navigate(`/dashboard/activities/${activity.userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la actividad');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-8 font-sans">
      <header className="mb-8">
        <div className="container mx-auto">
          <Link to="/dashboard" className="inline-flex items-center text-sky-400 hover:text-sky-300 transition-colors group">
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md rounded-xl p-6 shadow-xl">
            <h1 className="text-3xl font-bold text-sky-300 mb-6">Editar Actividad</h1>

            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
                <p className="text-slate-300">Cargando actividad...</p>
              </div>
            )}

            {error && !loading && (
              <div className="my-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
                <AlertTriangle size={20} className="mr-3" />
                <span>{error}</span>
              </div>
            )}

            {activity && !loading && !error && (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                    rows={3}
                  />
                </div>

                {activity.type === ActivityType.WORD_SEARCH && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-sky-300">Palabras y Pistas</h2>
                    {wordSearchWords.map((word, index) => (
                      <div key={index} className="flex gap-4">
                        <input
                          type="text"
                          value={word.word}
                          onChange={(e) => {
                            const newWords = [...wordSearchWords];
                            newWords[index].word = e.target.value;
                            setWordSearchWords(newWords);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Palabra"
                        />
                        <input
                          type="text"
                          value={word.hint}
                          onChange={(e) => {
                            const newWords = [...wordSearchWords];
                            newWords[index].hint = e.target.value;
                            setWordSearchWords(newWords);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Pista"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setWordSearchWords(words => words.filter((_, i) => i !== index));
                          }}
                          className="px-4 py-2.5 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setWordSearchWords([...wordSearchWords, { word: '', hint: '' }]);
                      }}
                      className="px-4 py-2.5 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 transition-colors"
                    >
                      Agregar Palabra
                    </button>
                  </div>
                )}

                {activity.type === ActivityType.CROSSWORD && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-sky-300">Pistas y Respuestas</h2>
                    {crosswordClues.map((clue, index) => (
                      <div key={index} className="flex gap-4">
                        <input
                          type="text"
                          value={clue.clue}
                          onChange={(e) => {
                            const newClues = [...crosswordClues];
                            newClues[index].clue = e.target.value;
                            setCrosswordClues(newClues);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Pista"
                        />
                        <input
                          type="text"
                          value={clue.answer}
                          onChange={(e) => {
                            const newClues = [...crosswordClues];
                            newClues[index].answer = e.target.value;
                            setCrosswordClues(newClues);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Respuesta"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCrosswordClues(clues => clues.filter((_, i) => i !== index));
                          }}
                          className="px-4 py-2.5 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCrosswordClues([...crosswordClues, { clue: '', answer: '' }]);
                      }}
                      className="px-4 py-2.5 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 transition-colors"
                    >
                      Agregar Pista
                    </button>
                  </div>
                )}

                {activity.type === ActivityType.WORD_CONNECTION && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-sky-300">Conexiones</h2>
                    {wordConnections.map((conn, index) => (
                      <div key={index} className="flex gap-4">
                        <input
                          type="text"
                          value={conn.word1}
                          onChange={(e) => {
                            const newConnections = [...wordConnections];
                            newConnections[index].word1 = e.target.value;
                            setWordConnections(newConnections);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Palabra 1"
                        />
                        <input
                          type="text"
                          value={conn.connection}
                          onChange={(e) => {
                            const newConnections = [...wordConnections];
                            newConnections[index].connection = e.target.value;
                            setWordConnections(newConnections);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Conexión"
                        />
                        <input
                          type="text"
                          value={conn.word2}
                          onChange={(e) => {
                            const newConnections = [...wordConnections];
                            newConnections[index].word2 = e.target.value;
                            setWordConnections(newConnections);
                          }}
                          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg"
                          placeholder="Palabra 2"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setWordConnections(connections => connections.filter((_, i) => i !== index));
                          }}
                          className="px-4 py-2.5 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setWordConnections([...wordConnections, { word1: '', word2: '', connection: '' }]);
                      }}
                      className="px-4 py-2.5 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 transition-colors"
                    >
                      Agregar Conexión
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/activities/${activity.userId}`)}
                    className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={20} className="mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center py-8 mt-12 text-sm text-slate-500 border-t border-slate-700">
        <p>&copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default EditActivityScreen; 