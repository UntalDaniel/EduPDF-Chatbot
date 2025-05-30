import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getPdfs } from '../../firebase/pdfService';
import { PdfType } from '../../types/pdfTypes';
import { BookOpen, MessageSquare, FileText, LogOut, Loader2 } from 'lucide-react';

const TeacherDashboard: React.FC = () => {
    const [pdfs, setPdfs] = useState<PdfType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPdfs = async () => {
            try {
                const pdfsData = await getPdfs();
                setPdfs(pdfsData);
            } catch (err) {
                console.error('Error al cargar PDFs:', err);
                setError('Error al cargar los PDFs');
            } finally {
                setLoading(false);
            }
        };

        fetchPdfs();
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/auth');
        } catch (err) {
            console.error('Error al cerrar sesión:', err);
            setError('Error al cerrar sesión');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <nav className="bg-slate-800 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-sky-400">EduPDF - Panel de Profesor</h1>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                        <LogOut className="h-5 w-5" />
                        Cerrar Sesión
                    </button>
                </div>
            </nav>

            <main className="container mx-auto p-4">
                {error && (
                    <div className="mb-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pdfs.map((pdf) => (
                        <div
                            key={pdf.id}
                            className="bg-slate-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                        >
                            <h2 className="text-xl font-semibold text-sky-400 mb-2">{pdf.title}</h2>
                            <p className="text-slate-400 mb-4">{pdf.description}</p>
                            
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => navigate(`/chat?pdfId=${pdf.id}`)}
                                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                    Chat
                                </button>
                                
                                <button
                                    onClick={() => navigate(`/teacher/create-activity?pdfId=${pdf.id}`)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                                >
                                    <FileText className="h-5 w-5" />
                                    Crear Actividad
                                </button>
                                
                                <button
                                    onClick={() => navigate(`/teacher/create-exam?pdfId=${pdf.id}`)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
                                >
                                    <BookOpen className="h-5 w-5" />
                                    Crear Examen
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {pdfs.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <BookOpen className="mx-auto h-16 w-16 text-slate-600 mb-4" />
                        <h2 className="text-2xl font-semibold text-slate-400 mb-2">
                            No hay PDFs disponibles
                        </h2>
                        <p className="text-slate-500">
                            Sube un PDF para comenzar a crear actividades y exámenes.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TeacherDashboard; 