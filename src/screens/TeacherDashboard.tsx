    // src/screens/TeacherDashboard.tsx
    // ... (importaciones existentes)

    const TeacherDashboard: React.FC = () => {
        // ... (estados existentes: user, selectedFile, userPdfs, etc.)
        const navigate = useNavigate();
        const [user, setUser] = useState<User | null>(auth?.currentUser || null);
        const [loadingAuth, setLoadingAuth] = useState(!auth?.currentUser);
        
        const [selectedFile, setSelectedFile] = useState<File | null>(null);
        const [uploading, setUploading] = useState(false);
        const [uploadProgress, setUploadProgress] = useState(0);
        const [uploadError, setUploadError] = useState<string | null>(null);
        const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
        const [processingBackend, setProcessingBackend] = useState(false); // Nuevo estado

        const [userPdfs, setUserPdfs] = useState<PdfMetadata[]>([]);
        const [loadingPdfs, setLoadingPdfs] = useState(false);
        const [selectedPdf, setSelectedPdf] = useState<PdfMetadata | null>(null);
        const [searchTerm, setSearchTerm] = useState('');

        const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', message: '' });
        const [deletingPdf, setDeletingPdf] = useState<boolean>(false);


        // ... (useEffect para auth y fetchUserPdfs)
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
                setModal({ isOpen: true, title: "Error de Configuración", message: "El servicio de base de datos no está disponible." });
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
                setModal({ isOpen: true, title: "Error al Cargar Documentos", message: "No se pudieron cargar los documentos PDF. Intenta recargar la página." });
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
                if (event.target.files[0].size > 15 * 1024 * 1024) { // Límite de 15MB (ajusta según necesidad)
                    setUploadError("El archivo es demasiado grande. Máximo 15MB.");
                    setSelectedFile(null);
                    if (event.target) event.target.value = "";
                    return;
                }
                setSelectedFile(event.target.files[0]);
                setUploadError(null);
                setUploadSuccess(null);
            }
        };

        const handleProcessPdfInBackend = async (pdfIdForBackend: string, fileToProcess: File) => {
            if (!fileToProcess) {
                setUploadError("No hay archivo seleccionado para procesar en backend.");
                return;
            }
            setProcessingBackend(true);
            setUploadError(null); // Limpiar errores previos
            setUploadSuccess(null); // Limpiar mensajes de éxito previos

            const formData = new FormData();
            formData.append("pdf_id", pdfIdForBackend);
            // El nombre del campo "file" debe coincidir con el parámetro en tu endpoint FastAPI:
            // async def process_pdf_endpoint(pdf_id: str = Form(...), file: UploadFile = File(...))
            formData.append("file", fileToProcess, fileToProcess.name);

            try {
                console.log(`Enviando PDF ID: ${pdfIdForBackend} y archivo: ${fileToProcess.name} al backend /process-pdf/`);
                const response = await fetch("http://localhost:8000/process-pdf/", {
                    method: "POST",
                    body: formData,
                    // No es necesario 'Content-Type': 'multipart/form-data' explícitamente,
                    // el navegador lo establece automáticamente para FormData.
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: "Error desconocido del backend al procesar PDF." }));
                    console.error("Error del backend /process-pdf/:", errorData);
                    throw new Error(errorData.detail || `Error del servidor: ${response.statusText}`);
                }

                const result = await response.json();
                console.log("Respuesta del backend /process-pdf/:", result);
                setUploadSuccess(result.message || `PDF '${fileToProcess.name}' enviado para procesamiento en backend.`);
                // No es necesario recargar los PDFs aquí a menos que el backend modifique metadatos visibles inmediatamente.
                // El índice se crea en segundo plano en el backend.
            } catch (error: any) {
                console.error("Error enviando PDF al backend para procesar:", error);
                setUploadError(`Error al procesar PDF en backend: ${error.message}`);
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
            setUploadProgress(0);

            const storagePath = `pdfs/${user.uid}/${Date.now()}_${selectedFile.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Error al subir archivo a Firebase Storage:", error);
                    setUploadError(`Error al subir a Storage: ${error.message}`);
                    setUploading(false);
                },
                async () => { // Completado de subida a Firebase Storage
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        const pdfMetadataToSave: Omit<PdfMetadata, 'id' | 'fechaSubida' | 'idDocente'> = {
                            nombreArchivoOriginal: selectedFile.name,
                            nombreEnStorage: storagePath,
                            urlDescargaStorage: downloadURL,
                            titulo: selectedFile.name.replace(/\.pdf$/i, ""),
                        };
                        
                        // Guardar metadatos en Firestore
                        const newPdfId = await savePdfMetadata(pdfMetadataToSave); // savePdfMetadata debe devolver el ID
                        setUploadSuccess(`¡"${selectedFile.name}" subido a Firebase! ID: ${newPdfId}. Ahora procesando en backend...`);
                        
                        // Llamar al backend para procesar el PDF y crear el índice
                        if (selectedFile) { // selectedFile debería estar disponible aquí
                           await handleProcessPdfInBackend(newPdfId, selectedFile);
                        } else {
                            console.warn("selectedFile es null después de la subida a Storage, no se puede enviar al backend.");
                            setUploadError("Error interno: no se pudo encontrar el archivo para enviar al backend.");
                        }

                        // Limpiar y recargar lista de PDFs
                        const currentSelectedFile = selectedFile; // Guardar referencia por si acaso
                        setSelectedFile(null);
                        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
                        if (fileInput) fileInput.value = "";
                        if (user) fetchUserPdfs(user.uid); // Recargar la lista de PDFs

                    } catch (error: any) {
                        console.error("Error después de la subida a Storage (guardar metadatos o procesar en backend):", error);
                        setUploadError(`Error post-subida: ${error.message}`);
                    } finally {
                        setUploading(false); // Terminar estado de subida general
                        // processingBackend se maneja dentro de handleProcessPdfInBackend
                    }
                }
            );
        };

        // ... (resto de las funciones: handleLogout, formatDate, handleSelectPdf, openActionModal, openDeleteConfirmModal, handleModalConfirm, closeModal)
        // ... (JSX del componente)
        // Asegúrate de deshabilitar el botón de "Confirmar y Subir PDF" si processingBackend es true también.
        // Y mostrar un indicador si processingBackend es true.
        // Ejemplo en el botón de subida:
        // disabled={!selectedFile || uploading || processingBackend}
        // {uploading ? ... : processingBackend ? 'Procesando en Backend...' : 'Confirmar y Subir PDF'}
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

        const handleSelectPdf = (pdf: PdfMetadata) => {
            setSelectedPdf(pdf.id === selectedPdf?.id ? null : pdf);
        };
        
        const openActionModal = (pdf: PdfMetadata, action: 'createActivity' | 'createExam') => {
            setSelectedPdf(pdf); 
            const actionText = action === 'createActivity' ? 'Crear Actividad' : 'Crear Examen';
            setModal({
                isOpen: true,
                title: `${actionText}: ${pdf.titulo || pdf.nombreArchivoOriginal}`,
                message: `Estás a punto de iniciar la creación de una ${action === 'createActivity' ? 'actividad' : 'examen'} para este PDF. ¿Continuar?`,
                pdfId: pdf.id,
                actionType: action
            });
        };

        const openDeleteConfirmModal = (pdf: PdfMetadata) => {
            setSelectedPdf(pdf); 
            setModal({
                isOpen: true,
                title: "Confirmar Eliminación",
                message: `¿Eliminar permanentemente "${pdf.titulo || pdf.nombreArchivoOriginal}"? Esta acción no se puede deshacer.`,
                pdfId: pdf.id,
                actionType: 'deleteConfirm'
            });
        };
        
        const handleModalConfirm = async () => {
            if (!modal.pdfId || !modal.actionType) return;

            if (modal.actionType === 'deleteConfirm') {
                setDeletingPdf(true);
                try {
                    const pdfToDelete = userPdfs.find(p => p.id === modal.pdfId);
                    if (!pdfToDelete || !storage) throw new Error("PDF no encontrado o servicio de storage no disponible.");
                    
                    const fileRef = ref(storage, pdfToDelete.nombreEnStorage); 
                    await deleteObject(fileRef);
                    await deletePdfFirestore(modal.pdfId);

                    setUserPdfs(prevPdfs => prevPdfs.filter(p => p.id !== modal.pdfId));
                    if (selectedPdf?.id === modal.pdfId) setSelectedPdf(null);
                    
                    closeModal(); 
                    setTimeout(() => { 
                         setModal({ isOpen: true, title: "Éxito", message: `"${pdfToDelete.titulo || pdfToDelete.nombreArchivoOriginal}" eliminado correctamente.` });
                    }, 100);

                } catch (error) {
                    console.error("Error al eliminar PDF:", error);
                    closeModal(); 
                     setTimeout(() => {
                        setModal({ isOpen: true, title: "Error de Eliminación", message: `No se pudo eliminar el PDF. ${error instanceof Error ? error.message : 'Error desconocido.'}` });
                    }, 100);
                } finally {
                    setDeletingPdf(false);
                }
            } else if (modal.actionType === 'createActivity') {
                navigate(`/dashboard/create-activity/${modal.pdfId}`);
                closeModal(); 
            } else if (modal.actionType === 'createExam') {
                alert(`Funcionalidad "Crear Examen" para PDF "${modal.pdfId}" aún no implementada.`);
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
                {/* Header */}
                <header className="mb-8 md:mb-12">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center py-4 gap-4 border-b border-slate-700">
                        <div className="flex items-center">
                            <BookOpen className="h-10 w-10 text-sky-500 mr-3" />
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-sky-400">
                                EduPDF <span className="text-slate-400 font-light">Panel</span>
                            </h1>
                        </div>
                        <div className="flex items-center space-x-3 sm:space-x-4">
                            <div className="flex items-center space-x-2 bg-slate-700/50 px-3 py-1.5 rounded-lg">
                                <UserCircle className="h-6 w-6 text-slate-400" />
                                <span className="text-sm text-slate-300 truncate max-w-[120px] sm:max-w-xs" title={user.displayName || user.email || 'Usuario'}>
                                    {user.displayName || user.email?.split('@')[0] || 'Usuario'}
                                </span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center text-sm"
                            >
                               <LogOut size={16} className="mr-1.5"/> Salir
                            </button>
                        </div>
                    </div>
                </header>

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
                                    {uploading ? `Subiendo a Firebase... ${uploadProgress.toFixed(0)}%` : processingBackend ? 'Procesando en Backend...' : 'Confirmar y Subir PDF'}
                                </button>
                                {uploadError && (
                                    <div className="mt-3 p-3 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center text-sm">
                                        <AlertCircle size={18} className="mr-2 shrink-0"/> <span className="break-all">{uploadError}</span>
                                    </div>
                                )}
                                {uploadSuccess && (
                                     <div className="mt-3 p-3 bg-green-700/30 text-green-300 border border-green-600/50 rounded-lg flex items-center text-sm">
                                        <CheckCircle2 size={18} className="mr-2 shrink-0"/> <span className="break-all">{uploadSuccess}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="bg-slate-800/70 border border-slate-700/80 p-5 md:p-6 rounded-xl shadow-2xl">
                            <h3 className="text-xl font-semibold mb-4 text-sky-400 border-b border-slate-700 pb-3">Acciones con PDF</h3>
                            {!selectedPdf && <p className="text-sm text-slate-400 italic py-2">Selecciona un PDF de tu lista para habilitar estas acciones.</p>}
                             <div className="space-y-3 mt-2">
                                <button 
                                    onClick={() => selectedPdf && navigate(`/dashboard/chat/${selectedPdf.id}`)}
                                    disabled={!selectedPdf || uploading || deletingPdf || processingBackend}
                                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 px-4 rounded-lg transition-all duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-md hover:shadow-lg"
                                >
                                    <MessageCircle size={18} className="mr-2"/> Chatear con PDF
                                </button>
                                <button 
                                    onClick={() => selectedPdf && openActionModal(selectedPdf, 'createActivity')}
                                    disabled={!selectedPdf || uploading || deletingPdf || processingBackend}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg transition-all duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow-md hover:shadow-lg"
                                >
                                    <PlusCircle size={18} className="mr-2"/> Crear Actividad
                                </button>
                                 <button 
                                    onClick={() => selectedPdf && openActionModal(selectedPdf, 'createExam')}
                                    disabled={!selectedPdf || uploading || deletingPdf || processingBackend}
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
                                        className={`bg-slate-700/60 p-3.5 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer border
                                                    ${selectedPdf?.id === pdf.id ? 'border-sky-500 ring-2 ring-sky-500 scale-[1.015]' : 'border-slate-600/70 hover:border-sky-600/70'}`}
                                        onClick={() => handleSelectPdf(pdf)}
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
                                            <div className="flex space-x-1.5 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); if(pdf.id) navigate(`/dashboard/chat/${pdf.id}`); }}
                                                    title="Chatear con este PDF"
                                                    className="p-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 transition-colors"
                                                    disabled={uploading || deletingPdf || processingBackend || !pdf.id}
                                                >
                                                    <MessageCircle size={16}/>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openActionModal(pdf, 'createActivity'); }}
                                                    title="Crear Actividad"
                                                    className="p-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 transition-colors"
                                                    disabled={uploading || deletingPdf || processingBackend}
                                                >
                                                    <PlusCircle size={16}/>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openActionModal(pdf, 'createExam'); }}
                                                    title="Crear Examen"
                                                    className="p-2 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50 transition-colors"
                                                    disabled={uploading || deletingPdf || processingBackend}
                                                >
                                                    <Edit3 size={16}/>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); window.open(pdf.urlDescargaStorage, '_blank');}}
                                                    title="Ver PDF"
                                                    className="p-2 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
                                                >
                                                    <FileText size={16}/>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openDeleteConfirmModal(pdf); }}
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
                                                <p><strong>ID:</strong> <span className="text-slate-300">{pdf.id}</span></p>
                                                <p><strong>URL:</strong> <a href={pdf.urlDescargaStorage} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">{pdf.urlDescargaStorage}</a></p>
                                                <p><strong>Storage Path:</strong> <span className="text-slate-300 break-all">{pdf.nombreEnStorage}</span></p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                {/* Modal de Confirmación/Acción */}
                {modal.isOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeModal}>
                        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full mx-auto"
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
                                ) : modal.actionType === 'createActivity' || modal.actionType === 'createExam' ? (
                                    <>
                                        <button
                                            onClick={closeModal}
                                            className="px-5 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleModalConfirm}
                                            className="px-5 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center"
                                        >
                                           <CheckCircle2 size={16} className="mr-1.5"/> Confirmar
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

                {canvasAppId && (
                    <div className="container mx-auto mt-10 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-center text-xs">
                        <h4 className="font-semibold mb-1 text-slate-300">Información de Depuración:</h4>
                        <p className="text-slate-400">User ID: <span className="font-mono">{user?.uid}</span> | App ID (Canvas): <span className="font-mono">{canvasAppId}</span></p>
                    </div>
                )}
                <footer className="text-center py-8 mt-10 text-xs text-slate-500 border-t border-slate-700/50">
                    <p>&copy; {new Date().getFullYear()} EduPDF. Creado con fines educativos.</p>
                </footer>
            </div>
        );
    };

    // Importaciones necesarias que ya deberías tener:
    import React, { useState, useEffect, ChangeEvent } from 'react';
    import { auth, canvasAppId, storage, db } from '../firebase/firebaseConfig';
    import type { User } from 'firebase/auth';
    import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
    import { Navigate, useNavigate } from 'react-router-dom';
    import { 
        LogOut, UserCircle, BookOpen, UploadCloud, FileText, List, AlertCircle, 
        CheckCircle2, Trash2, Edit3, PlusCircle, X, Loader2, Search, MessageCircle
    } from 'lucide-react'; 
    import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
    import { savePdfMetadata, getPdfsByTeacher, deletePdfMetadata as deletePdfFirestore } from '../firebase/firestoreService'; 
    import type { PdfMetadata } from '../firebase/firestoreService';
    import type { Timestamp } from 'firebase/firestore';

    interface ModalState {
        isOpen: boolean;
        title: string;
        message: string;
        pdfId?: string;
        actionType?: 'createActivity' | 'createExam' | 'deleteConfirm';
    }
    export default TeacherDashboard;
    