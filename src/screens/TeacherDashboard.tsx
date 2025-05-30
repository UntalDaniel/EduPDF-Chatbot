// src/screens/TeacherDashboard.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import { auth, canvasAppId, storage, db } from '../firebase/firebaseConfig';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { 
    LogOut, UserCircle, BookOpen, UploadCloud, FileText, List, AlertCircle, 
    CheckCircle2, Trash2, Edit3, PlusCircle, X, Loader2, Search, MessageCircle, Users, ListChecks
} from 'lucide-react'; 
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { savePdfMetadata, getPdfsByTeacher, deletePdfMetadata as deletePdfFirestore } from '../firebase/firestoreService'; 
import type { PdfMetadata } from '../firebase/firestoreService';
// IMPORTACIONES CORREGIDAS: Añadido updateDoc y serverTimestamp
import { Timestamp, doc, collection, updateDoc, serverTimestamp } from 'firebase/firestore'; 
import Toast from '../components/Toast';
import ModalSelectPdf from '../components/ModalSelectPdf';

// Definición de la URL del backend (ajusta según sea necesario para producción)
const FASTAPI_BACKEND_URL = process.env.NODE_ENV === 'development' 
                            ? "http://localhost:8000" 
                            : "TU_URL_DE_BACKEND_FASTAPI_DESPLEGADO"; // Reemplaza esto en producción


interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    pdfId?: string;
    actionType?: 'createActivity' | 'createExam' | 'deleteConfirm' | 'info';
}

interface ToastState {
    isVisible: boolean;
    message: string;
    type: 'error' | 'success' | 'info';
}

const TeacherDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(auth?.currentUser || null);
    const [loadingAuth, setLoadingAuth] = useState(!auth?.currentUser);
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [processingBackend, setProcessingBackend] = useState(false);

    const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);
    const [loadingPdfs, setLoadingPdfs] = useState(false);
    const [selectedPdf, setSelectedPdf] = useState<PdfMetadata | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', message: '' });
    const [deletingPdf, setDeletingPdf] = useState<boolean>(false);
    const [toast, setToast] = useState<ToastState>({ isVisible: false, message: '', type: 'info' });

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [actionType, setActionType] = useState<'chat' | 'createActivity' | 'createExam' | null>(null);
    const [showPdfModal, setShowPdfModal] = useState(false);

    useEffect(() => {
        if (!auth) {
            console.error("TeacherDashboard: Firebase auth instance is not available.");
            setLoadingAuth(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);
            if (currentUser) {
                fetchUserPdfs(currentUser.uid);
            } else {
                setUserPdfs([]);
                setSelectedPdf(null);
            }
        });
        return () => unsubscribe();
    }, []); 

    const fetchUserPdfs = async (uid: string) => {
        if (!db) {
            console.error("Firestore instance (db) is not available for fetching PDFs.");
            setModal({ isOpen: true, title: "Error de Configuración", message: "El servicio de base de datos no está disponible.", actionType: 'info' });
            return;
        }
        setLoadingPdfs(true);
        try {
            const pdfs = await getPdfsByTeacher(uid);
            setUserPdfs(pdfs.sort((a, b) => { 
                const timeA = (a.fechaSubida as Timestamp)?.seconds || 0;
                const timeB = (b.fechaSubida as Timestamp)?.seconds || 0;
                return timeB - timeA;
            }));
        } catch (error) {
            console.error("Error fetching user PDFs:", error);
            setModal({ isOpen: true, title: "Error al Cargar Documentos", message: "No se pudieron cargar los documentos PDF. Intenta recargar la página.", actionType: 'info' });
        } finally {
            setLoadingPdfs(false);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            if (event.target.files[0].type !== "application/pdf") {
                setUploadError("Por favor, selecciona un archivo PDF.");
                setSelectedFile(null);
                if (event.target) event.target.value = ""; 
                return;
            }
            if (event.target.files[0].size > 25 * 1024 * 1024) { 
                setUploadError("El archivo es demasiado grande. Máximo 25MB.");
                setSelectedFile(null);
                if (event.target) event.target.value = "";
                return;
            }
            setSelectedFile(event.target.files[0]);
            setUploadError(null);
            setUploadSuccess(null);
        }
    };

    const handleProcessPdfInBackend = async (pdfIdForBackend: string, userIdForBackend: string, fileToProcess: File) => {
        if (!fileToProcess) {
            setUploadError("No hay archivo seleccionado para procesar en backend.");
            return false; 
        }
        setProcessingBackend(true);
        setUploadError(null); 
        setUploadSuccess(null);

        const formData = new FormData();
        formData.append("pdf_id", pdfIdForBackend);
        formData.append("user_id", userIdForBackend); 
        formData.append("file", fileToProcess, fileToProcess.name);

        try {
            console.log(`Enviando PDF ID: ${pdfIdForBackend}, User ID: ${userIdForBackend}, Archivo: ${fileToProcess.name} al backend /upload-pdf/`);
            
            const response = await fetch(`${FASTAPI_BACKEND_URL}/upload-pdf/`, { 
                method: "POST",
                body: formData,
            });

            const result = await response.json(); 

            if (!response.ok) {
                console.error("Error del backend /upload-pdf/:", result);
                throw new Error(result.detail || `Error del servidor: ${response.statusText} (${response.status})`);
            }
            
            console.log("Respuesta del backend /upload-pdf/:", result);
            setUploadSuccess(result.message || `PDF '${fileToProcess.name}' enviado para procesamiento en backend.`);
            return true; 
        } catch (error: any) {
            console.error("Error enviando PDF al backend para procesar:", error);
            setUploadError(`Error al procesar PDF en backend: ${error.message}`);
            return false; 
        } finally {
            setProcessingBackend(false);
        }
    };


    const handleFileUpload = async () => {
        if (!selectedFile || !user || !storage || !db) {
            setUploadError("Selecciona un archivo PDF válido y asegúrate de estar autenticado y los servicios de Firebase disponibles.");
            return;
        }
        setUploading(true);
        setUploadError(null);
        setUploadSuccess(null);
        setProcessingBackend(false); 
        setUploadProgress(0);
            
        try {
            const pdfMetadataToSave: Omit<PdfMetadata, 'id' | 'fechaSubida' | 'idDocente'> = {
                nombreArchivoOriginal: selectedFile.name,
                nombreEnStorage: "", 
                urlDescargaStorage: "", 
                titulo: selectedFile.name.replace(/\.pdf$/i, ""),
            };
            
            const firestoreDocId = await savePdfMetadata(pdfMetadataToSave); 
            console.log(`Metadatos iniciales guardados en Firestore con ID: ${firestoreDocId}`);

            const storagePath = `pdfs/${user.uid}/${firestoreDocId}/${selectedFile.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                async (error) => { 
                    console.error("Error al subir archivo a Firebase Storage:", error);
                    setUploadError(`Error al subir a Storage: ${error.message}`);
                    setUploading(false);
                    if (firestoreDocId && db) {
                        try {
                            // Asumiendo que deletePdfFirestore solo necesita el ID del documento.
                            // Si necesita la colección, sería: await deleteDoc(doc(db, "documentosPDF", firestoreDocId));
                            await deletePdfFirestore(firestoreDocId); 
                            console.warn(`Registro de Firestore ${firestoreDocId} eliminado debido a fallo en subida a Storage.`);
                        } catch (deleteError) {
                            console.error(`Error eliminando registro de Firestore ${firestoreDocId} tras fallo de subida:`, deleteError);
                        }
                    }
                },
                async () => { 
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        
                        if (db) { 
                            const pdfDocRef = doc(db, "documentosPDF", firestoreDocId); 
                            await updateDoc(pdfDocRef, { // <--- updateDoc AHORA DEBERÍA ESTAR DISPONIBLE
                                nombreEnStorage: storagePath,
                                urlDescargaStorage: downloadURL,
                                fechaSubida: serverTimestamp() // <--- serverTimestamp AHORA DEBERÍA ESTAR DISPONIBLE
                            });
                            console.log(`Metadatos de Firestore actualizados para ${firestoreDocId} con info de Storage.`);
                        }
                        
                        setUploadSuccess(`¡"${selectedFile.name}" subido (ID: ${firestoreDocId})! Procesando en backend...`);
                        
                        if (selectedFile) {
                           const backendSuccess = await handleProcessPdfInBackend(firestoreDocId, user.uid, selectedFile);
                           if (backendSuccess) {
                               setUploadSuccess(`"${selectedFile.name}" (ID: ${firestoreDocId}) subido y procesado por el backend.`);
                           } else {
                               setUploadError(prev => prev ? `${prev} (Fallo en procesamiento backend)` : `Fallo en procesamiento backend para "${selectedFile.name}"`);
                           }
                        } else {
                            console.warn("selectedFile es null después de la subida a Storage, no se puede enviar al backend.");
                            setUploadError("Error interno: no se pudo encontrar el archivo para enviar al backend.");
                        }
        
                        setSelectedFile(null);
                        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
                        if (fileInput) fileInput.value = "";
                        if (user) fetchUserPdfs(user.uid); 
        
                    } catch (error: any) {
                        console.error("Error después de la subida a Storage (actualizar Firestore o procesar en backend):", error);
                        setUploadError(`Error post-subida: ${error.message}`);
                    } finally {
                        setUploading(false); 
                    }
                }
            );
        } catch (initialFirestoreError: any) {
            console.error("Error guardando metadatos iniciales en Firestore:", initialFirestoreError);
            setUploadError(`Error preparando subida: ${initialFirestoreError.message}`);
            setUploading(false);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try { await firebaseSignOut(auth); } 
        catch (error) { console.error('Error al cerrar sesión:', error); }
    };

    const formatDate = (timestamp: unknown): string => {
        if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp && typeof (timestamp as Timestamp).seconds === 'number') {
            return new Date((timestamp as Timestamp).seconds * 1000).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return 'Fecha desconocida';
    };

    const handleSelectPdf = (pdfId: string) => {
        setShowPdfModal(false);
        if (actionType === 'chat') navigate(`/dashboard/chat/${pdfId}`);
        if (actionType === 'createActivity') navigate(`/dashboard/activities/${pdfId}`);
        if (actionType === 'createExam') navigate(`/dashboard/create-exam/${pdfId}`);
        setActionType(null);
    };
    
    const handleAction = (type: 'chat' | 'createActivity' | 'createExam') => {
        if (!selectedPdf) {
            setActionType(type);
            setShowPdfModal(true);
        } else {
            if (type === 'chat') navigate(`/dashboard/chat/${selectedPdf.id}`);
            if (type === 'createActivity') navigate(`/dashboard/activities/${selectedPdf.id}`);
            if (type === 'createExam') navigate(`/dashboard/create-exam/${selectedPdf.id}`);
        }
    };

    const openDeleteConfirmModal = (pdf: PdfMetadata) => {
        setSelectedPdf(pdf); 
        setModal({
            isOpen: true,
            title: "Confirmar Eliminación",
            message: `¿Eliminar permanentemente "${pdf.titulo || pdf.nombreArchivoOriginal}"? Esta acción no se puede deshacer y borrará el archivo de la nube y sus datos asociados.`,
            pdfId: pdf.id,
            actionType: 'deleteConfirm'
        });
    };
    
    const handleModalConfirm = async () => {
        if (!modal.pdfId || !modal.actionType || !user) return;

        if (modal.actionType === 'deleteConfirm') {
            if (!storage || !db) {
                setToast({
                    isVisible: true,
                    message: "Error: Servicio no disponible. Intenta más tarde.",
                    type: 'error'
                });
                return;
            }

            setDeletingPdf(true);
            try {
                const pdfToDelete = userPdfs.find(p => p.id === modal.pdfId);
                if (!pdfToDelete || !pdfToDelete.id) {
                    throw new Error("PDF no encontrado o ID de PDF faltante");
                }

                const backendResponse = await fetch(`${FASTAPI_BACKEND_URL}/pdfs/${pdfToDelete.id}/?user_id=${user.uid}`, {
                    method: 'DELETE',
                });

                if (!backendResponse.ok) {
                    console.warn(`Backend deletion warning for PDF ${pdfToDelete.id}:`, await backendResponse.text());
                }

                const fileRef = ref(storage, pdfToDelete.nombreEnStorage);
                try {
                    await deleteObject(fileRef);
                } catch (storageError: any) {
                    if (storageError.code === 'storage/object-not-found') {
                        setToast({
                            isVisible: true,
                            message: "El archivo ya fue eliminado anteriormente",
                            type: 'info'
                        });
                    }
                }

                await deletePdfFirestore(pdfToDelete.id);
                setUserPdfs(prevPdfs => prevPdfs.filter(p => p.id !== modal.pdfId));
                if (selectedPdf?.id === modal.pdfId) setSelectedPdf(null);

                setToast({
                    isVisible: true,
                    message: `"${pdfToDelete.titulo || pdfToDelete.nombreArchivoOriginal}" eliminado correctamente`,
                    type: 'success'
                });
            } catch (error) {
                console.error("Error al eliminar PDF:", error);
                setToast({
                    isVisible: true,
                    message: `Error al eliminar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                    type: 'error'
                });
            } finally {
                setDeletingPdf(false);
                closeModal();
            }
        } else if (modal.actionType === 'createActivity') {
            navigate(`/dashboard/activities/${modal.pdfId}`);
            closeModal();
        } else if (modal.actionType === 'createExam') {
            navigate(`/dashboard/create-exam/${modal.pdfId}`);
            closeModal();
        }
    };

    const closeModal = () => {
        if (modal.actionType === 'deleteConfirm' && deletingPdf) return;
        setModal({ isOpen: false, title: '', message: '' });
    };

    const filteredPdfs = userPdfs.filter(pdf => 
        (pdf.titulo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (pdf.nombreArchivoOriginal?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (loadingAuth) {
        return ( 
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                <Loader2 className="animate-spin h-12 w-12 text-sky-500" />
                <p className="mt-4 text-lg text-slate-300">Cargando tu espacio de trabajo...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8 font-sans">
            <main className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                <div className="lg:col-span-4 xl:col-span-3 space-y-6 md:space-y-8">
                    <div className="bg-slate-800/70 border border-slate-700/80 p-5 md:p-6 rounded-xl shadow-2xl">
                        <h2 className="text-xl font-semibold mb-5 text-sky-400 border-b border-slate-700 pb-3">Subir Nuevo PDF</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="pdf-upload" className="sr-only">Seleccionar archivo PDF</label>
                                <input
                                    id="pdf-upload"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border file:border-slate-600 file:text-sm file:font-semibold file:bg-slate-700 file:text-sky-300 hover:file:bg-slate-600 disabled:opacity-50 cursor-pointer"
                                    disabled={uploading || processingBackend}
                                />
                            </div>
                            {selectedFile && !uploading && (
                                <p className="text-xs text-slate-400">Seleccionado: <span className="font-medium text-slate-300">{selectedFile.name}</span></p>
                            )}
                            {uploading && (
                                <div className="w-full bg-slate-700 rounded-full h-2.5 my-2">
                                    <div className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            )}
                            <button
                                onClick={handleFileUpload}
                                disabled={!selectedFile || uploading || processingBackend}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <UploadCloud size={18} className="mr-2" />
                                {uploading ? `Subiendo... ${uploadProgress.toFixed(0)}%` : processingBackend ? 'Procesando en Backend...' : 'Confirmar y Subir PDF'}
                            </button>
                            {uploadError && (
                                <div className="mt-3 p-3 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center text-sm">
                                    <AlertCircle size={18} className="mr-2 shrink-0"/> <span className="break-all">{uploadError}</span>
                                </div>
                            )}
                            {uploadSuccess && !uploadError && (
                                 <div className="mt-3 p-3 bg-green-700/30 text-green-300 border border-green-600/50 rounded-lg flex items-center text-sm">
                                    <CheckCircle2 size={18} className="mr-2 shrink-0"/> <span className="break-all">{uploadSuccess}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-slate-800/70 border border-slate-700/80 p-5 md:p-6 rounded-xl shadow-2xl">
                        <h3 className="text-xl font-semibold mb-4 text-sky-400 border-b border-slate-700 pb-3">Acciones con PDF Seleccionado</h3>
                        {!selectedPdf && <p className="text-sm text-slate-400 italic py-2">Selecciona un PDF de tu lista para habilitar estas acciones.</p>}
                         <div className="space-y-3 mt-2">
                            <button 
                                onClick={() => handleAction('chat')}
                                disabled={uploading || deletingPdf || processingBackend}
                                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 px-4 rounded-lg transition-all duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-md hover:shadow-lg"
                            >
                                <MessageCircle size={18} className="mr-2"/> Chatear con PDF
                            </button>
                            <button 
                                onClick={() => handleAction('createActivity')}
                                disabled={uploading || deletingPdf || processingBackend}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg transition-all duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-md hover:shadow-lg"
                            >
                                <PlusCircle size={18} className="mr-2"/> Crear Actividad
                            </button>
                             <button 
                                onClick={() => handleAction('createExam')}
                                disabled={uploading || deletingPdf || processingBackend}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 px-4 rounded-lg transition-all duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-md hover:shadow-lg"
                            >
                                <Edit3 size={18} className="mr-2"/> Crear Examen
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 xl:col-span-9 bg-slate-800/70 border border-slate-700/80 p-5 md:p-6 rounded-xl shadow-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                        <h2 className="text-2xl font-semibold text-sky-400 flex items-center"><List size={28} className="mr-2.5"/>Mis Documentos PDF</h2>
                        <div className="relative w-full sm:w-64">
                            <input 
                                type="text"
                                placeholder="Buscar documentos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm placeholder-slate-400"
                            />
                            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"/>
                        </div>
                    </div>
                    
                    {loadingPdfs && <div className="flex flex-col items-center justify-center py-12 text-slate-400"><Loader2 className="animate-spin h-10 w-10 text-sky-500 mb-3" /><p>Cargando tus documentos...</p></div>}
                    
                    {!loadingPdfs && userPdfs.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <FileText size={48} className="mx-auto mb-4 opacity-50"/>
                            <p className="text-lg">Aún no has subido ningún PDF.</p>
                            <p className="text-sm">Utiliza el panel de la izquierda para comenzar.</p>
                        </div>
                    )}
                    {!loadingPdfs && userPdfs.length > 0 && filteredPdfs.length === 0 && (
                         <div className="text-center py-12 text-slate-400">
                            <Search size={48} className="mx-auto mb-4 opacity-50"/>
                            <p className="text-lg">No se encontraron documentos que coincidan con "<span className="font-semibold text-slate-300">{searchTerm}</span>".</p>
                        </div>
                    )}

                    {!loadingPdfs && filteredPdfs.length > 0 && (
                        <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredPdfs.map((pdf) => (
                                <div 
                                    key={pdf.id} 
                                    className={`bg-slate-700/60 p-3.5 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer border ${selectedPdf?.id === pdf.id ? 'border-sky-500 ring-2 ring-sky-500 scale-[1.015]' : 'border-slate-600/70 hover:border-sky-600/70'}`}
                                    onClick={() => handleSelectPdf(pdf.id)}
                                >
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-start min-w-0 flex-grow">
                                            <FileText size={28} className="text-sky-400 mr-3 sm:mr-4 mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <h4 className="font-semibold text-base text-sky-300 hover:text-sky-200 transition-colors truncate" title={pdf.titulo || pdf.nombreArchivoOriginal}>
                                                    {pdf.titulo || pdf.nombreArchivoOriginal}
                                                </h4>
                                                <p className="text-xs text-slate-400">
                                                    Subido: {formatDate(pdf.fechaSubida)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate(`/dashboard/activities/${pdf.id}`); }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium shadow transition-colors"
                                                title="Ver o crear actividades para este PDF"
                                            >
                                                <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2z' /></svg>
                                                Actividades
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate(`/dashboard/tools/${pdf.id}`); }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-medium shadow transition-colors"
                                                title="Herramientas inteligentes para este PDF"
                                            >
                                                <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.232 5.232l3.536 3.536M9 11l6 6M7.5 7.5l9 9M2 12a10 10 0 1020 0 10 10 0 00-20 0z' /></svg>
                                                Herramientas
                                            </button>
                                            <button 
                                                onClick={e => { e.stopPropagation(); window.open(pdf.urlDescargaStorage, '_blank');}}
                                                title="Ver PDF"
                                                className="p-2 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
                                            >
                                                <FileText size={16}/>
                                            </button>
                                            <button 
                                                onClick={e => { e.stopPropagation(); openDeleteConfirmModal(pdf); }}
                                                title="Eliminar PDF"
                                                className="p-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 transition-colors"
                                                disabled={uploading || deletingPdf || processingBackend}
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                    {selectedPdf?.id === pdf.id && (
                                        <div className="mt-3 pt-3 border-t border-slate-600/50 text-xs text-slate-400 space-y-1">
                                            <p><strong>ID Documento:</strong> <span className="text-slate-300">{pdf.id}</span></p>
                                            <p><strong>URL Descarga:</strong> <a href={pdf.urlDescargaStorage} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">{pdf.urlDescargaStorage}</a></p>
                                            <p><strong>Ruta Storage:</strong> <span className="text-slate-300 break-all">{pdf.nombreEnStorage}</span></p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {modal.isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeModal}>
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full mx-auto animate-modalEnter"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-sky-400">{modal.title}</h3>
                            {!(modal.actionType === 'deleteConfirm' && deletingPdf) && (
                                <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-700">
                                    <X size={22} />
                                </button>
                            )}
                        </div>
                        <p className="text-slate-300 mb-6 text-sm leading-relaxed">{modal.message}</p>
                        <div className="flex justify-end space-x-3">
                            {modal.actionType === 'deleteConfirm' ? (
                                <>
                                    <button
                                        onClick={closeModal}
                                        disabled={deletingPdf}
                                        className="px-5 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors disabled:opacity-60"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleModalConfirm}
                                        disabled={deletingPdf}
                                        className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center min-w-[120px]"
                                    >
                                        {deletingPdf ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Trash2 size={14} className="mr-1.5"/>}
                                        {deletingPdf ? 'Eliminando...' : 'Sí, Eliminar'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={closeModal}
                                    className="px-5 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                                >
                                    Entendido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ModalSelectPdf
                open={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                onSelect={handleSelectPdf}
                pdfs={userPdfs}
                title={
                    actionType === 'chat' ? 'Selecciona un PDF para Chatear'
                    : actionType === 'createActivity' ? 'Selecciona un PDF para Crear Actividad'
                    : actionType === 'createExam' ? 'Selecciona un PDF para Crear Examen'
                    : 'Selecciona un PDF'
                }
            />
        </div>
    );
};

export default TeacherDashboard;