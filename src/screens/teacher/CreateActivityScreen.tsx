import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getPdfById } from '../../firebase/pdfService';
import { PdfType } from '../../types/pdfTypes';
import { ActivityType, WordSearchData, CrosswordData, WordConnectionData } from '../../types/activityTypes';
import { createActivity } from '../../firebase/activityService';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

const CreateActivityScreen: React.FC = () => {
    const [searchParams] = useSearchParams();
    const pdfId = searchParams.get('pdfId');
    const [pdf, setPdf] = useState<PdfType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activityType, setActivityType] = useState<ActivityType>(ActivityType.WORD_SEARCH);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    // Datos específicos para cada tipo de actividad
    const [wordSearchData, setWordSearchData] = useState<WordSearchData>({
        words: [],
        grid: [],
        solution: []
    });

    const [crosswordData, setCrosswordData] = useState<CrosswordData>({
        grid: [],
        solution: [],
        clues: {
            across: {},
            down: {}
        }
    });

    const [wordConnectionData, setWordConnectionData] = useState<WordConnectionData>({
        words: [],
        connections: {}
    });

    useEffect(() => {
        const fetchPdf = async () => {
            if (!pdfId) {
                setError('No se proporcionó un ID de PDF');
                setLoading(false);
                return;
            }

            try {
                const pdfData = await getPdfById(pdfId);
                setPdf(pdfData);
            } catch (err) {
                console.error('Error al cargar PDF:', err);
                setError('Error al cargar el PDF');
            } finally {
                setLoading(false);
            }
        };

        fetchPdf();
    }, [pdfId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !pdf) return;

        setSubmitting(true);
        setError(null);

        try {
            let activityData;
            switch (activityType) {
                case ActivityType.WORD_SEARCH:
                    activityData = wordSearchData;
                    break;
                case ActivityType.CROSSWORD:
                    activityData = crosswordData;
                    break;
                case ActivityType.WORD_CONNECTION:
                    activityData = wordConnectionData;
                    break;
                default:
                    throw new Error('Tipo de actividad no válido');
            }

            await createActivity({
                type: activityType,
                title,
                description,
                pdfId: pdf.id,
                userId: user.uid,
                data: activityData
            });

            navigate('/teacher');
        } catch (err) {
            console.error('Error al crear actividad:', err);
            setError('Error al crear la actividad');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <ArrowLeft 
                        className="w-6 h-6 text-blue-600 cursor-pointer hover:text-blue-800" 
                        onClick={() => navigate('/dashboard')} 
                    />
                    <h1 className="text-2xl font-bold text-gray-900">Crear Actividad</h1>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <ArrowLeft 
                    className="w-6 h-6 text-blue-600 cursor-pointer hover:text-blue-800" 
                    onClick={() => navigate('/dashboard')} 
                />
                <h1 className="text-2xl font-bold text-gray-900">Crear Actividad</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Título
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Descripción
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label htmlFor="activityType" className="block text-sm font-medium text-gray-700">
                        Tipo de Actividad
                    </label>
                    <select
                        id="activityType"
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value as ActivityType)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                        <option value={ActivityType.WORD_SEARCH}>Sopa de Letras</option>
                        <option value={ActivityType.CROSSWORD}>Crucigrama</option>
                        <option value={ActivityType.WORD_CONNECTION}>Conexión de Palabras</option>
                    </select>
                </div>

                {/* Aquí irían los campos específicos para cada tipo de actividad */}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            'Crear Actividad'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateActivityScreen; 