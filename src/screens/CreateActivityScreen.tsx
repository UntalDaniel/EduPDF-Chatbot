// src/screens/CreateActivityScreen.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, FileText, Loader2, AlertTriangle, Puzzle } from 'lucide-react';
import { db } from '../firebase/firebaseConfig'; // Para db
import { getPdfById } from '../firebase/firestoreService'; // Para obtener datos del PDF
import type { PdfMetadata } from '../firebase/firestoreService'; // Tipo

const CreateActivityScreen: React.FC = () => {
  const { pdfId } = useParams<{ pdfId: string }>();
  const navigate = useNavigate();
  const [pdfDetails, setPdfDetails] = useState<PdfMetadata | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const [activityType, setActivityType] = useState<string>(''); // e.g., 'wordSearch', 'fillBlanks'
  const [activityTitle, setActivityTitle] = useState<string>('');
  // Aquí irían más estados para la configuración específica de cada actividad

  useEffect(() => {
    if (!pdfId) {
      setErrorPdf("No se proporcionó un ID de PDF.");
      setLoadingPdf(false);
      return;
    }
    if (!db) {
        setErrorPdf("Servicio de base de datos no disponible.");
        setLoadingPdf(false);
        return;
    }

    const fetchDetails = async () => {
      setLoadingPdf(true);
      try {
        const details = await getPdfById(pdfId);
        if (details) {
          setPdfDetails(details);
          setActivityTitle(`Actividad para ${details.titulo || details.nombreArchivoOriginal}`);
        } else {
          setErrorPdf("PDF no encontrado.");
        }
      } catch (err) {
        console.error("Error fetching PDF details:", err);
        setErrorPdf("Error al cargar los detalles del PDF.");
      } finally {
        setLoadingPdf(false);
      }
    };
    fetchDetails();
  }, [pdfId]);

  const handleSubmitActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDetails) {
        alert("No hay detalles del PDF para crear la actividad.");
        return;
    }
    if (!activityType) {
        alert("Por favor, selecciona un tipo de actividad.");
        return;
    }
    // Lógica para procesar y guardar la actividad
    // Esto implicaría llamar a una función (quizás en firestoreService o un nuevo servicio de actividades)
    // que podría interactuar con el backend de IA.
    console.log({
      action: "Crear Actividad",
      pdfId: pdfDetails.id,
      pdfTitle: pdfDetails.titulo,
      activityType,
      activityTitle,
      // ...otros parámetros de la actividad
    });
    alert(`Actividad "${activityTitle}" del tipo "${activityType}" para el PDF "${pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}" (simulación). Redirigiendo al dashboard...`);
    navigate('/dashboard'); // Redirigir después de "crear"
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
        <div className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md p-6 md:p-8 rounded-xl shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <Settings size={32} className="text-sky-400 mr-4" />
            <h1 className="text-3xl font-bold text-sky-300">Crear Nueva Actividad</h1>
          </div>

          {loadingPdf && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
              <p className="text-slate-300">Cargando detalles del PDF...</p>
            </div>
          )}

          {errorPdf && !loadingPdf && (
            <div className="my-4 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
              <AlertTriangle size={20} className="mr-3" />
              <span>{errorPdf}</span>
            </div>
          )}

          {pdfDetails && !loadingPdf && !errorPdf && (
            <>
              <div className="mb-6 p-4 bg-slate-800/60 rounded-lg border border-slate-600">
                <div className="flex items-start">
                    <FileText size={24} className="text-green-400 mr-3 mt-1 shrink-0" />
                    <div>
                        <h2 className="text-xl font-semibold text-green-300 mb-1">PDF Seleccionado:</h2>
                        <p className="text-slate-200 truncate" title={pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}>
                            {pdfDetails.titulo || pdfDetails.nombreArchivoOriginal}
                        </p>
                        <p className="text-xs text-slate-400">ID: {pdfDetails.id}</p>
                    </div>
                </div>
              </div>

              <form onSubmit={handleSubmitActivity} className="space-y-6">
                <div>
                  <label htmlFor="activityTitle" className="block text-sm font-medium text-slate-300 mb-1">
                    Título de la Actividad
                  </label>
                  <input
                    type="text"
                    id="activityTitle"
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                    placeholder="Ej: Comprensión lectora Capítulo 1"
                  />
                </div>

                <div>
                  <label htmlFor="activityType" className="block text-sm font-medium text-slate-300 mb-1">
                    Tipo de Actividad
                  </label>
                  <select
                    id="activityType"
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                  >
                    <option value="" disabled>-- Selecciona un tipo --</option>
                    <option value="wordSearch">Sopa de Letras</option>
                    <option value="fillBlanks">Completar Espacios</option>
                    <option value="multipleChoiceQuiz">Examen Opción Múltiple (desde PDF)</option>
                    {/* Añadir más tipos de actividad aquí */}
                  </select>
                </div>
                
                {/* Aquí se podrían renderizar campos de configuración adicionales basados en activityType */}
                {activityType === 'wordSearch' && (
                    <div className="p-4 border border-slate-600 rounded-lg bg-slate-800/40">
                        <h3 className="text-lg font-medium text-sky-300 mb-2">Configuración Sopa de Letras</h3>
                        <p className="text-sm text-slate-400">Opciones como número de palabras, tamaño de la cuadrícula, etc., irían aquí.</p>
                        {/* Ejemplo: <input type="number" placeholder="Número de palabras" className="..."/> */}
                    </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center justify-center"
                >
                  <Puzzle size={20} className="mr-2" />
                  Generar y Guardar Actividad (Simulación)
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <footer className="text-center py-8 mt-12 text-sm text-slate-500 border-t border-slate-700">
        <p>&copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default CreateActivityScreen;
