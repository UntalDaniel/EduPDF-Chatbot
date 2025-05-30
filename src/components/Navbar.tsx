import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import ModalSelectPdf from './ModalSelectPdf';
import { getPdfsByTeacher } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [modalType, setModalType] = useState<'activities' | 'tools'>('activities');
  const [pdfs, setPdfs] = useState<PdfMetadata[]>([]);

  useEffect(() => {
    if (user) {
      getPdfsByTeacher(user.uid)
        .then(setPdfs)
        .catch(console.error);
    }
  }, [user]);

  const handleSelectPdf = (pdfId: string) => {
    setShowPdfModal(false);
    if (modalType === 'activities') {
      navigate(`/dashboard/activities/${pdfId}`);
    } else {
      navigate(`/dashboard/tools/${pdfId}`);
    }
  };

  const openPdfModal = (type: 'activities' | 'tools') => {
    setModalType(type);
    setShowPdfModal(true);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-blue-600">EduPDF</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Inicio
                </Link>
                <button
                  onClick={() => openPdfModal('activities')}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Actividades
                </button>
                <button
                  onClick={() => openPdfModal('tools')}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Herramientas
                </button>
                <Link
                  to="/dashboard/groups"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Grupos
                </Link>
                <Link
                  to="/dashboard/my-saved-exams"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Mis Exámenes
                </Link>
                <Link
                  to="/dashboard/my-forms"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Mis Formatos
                </Link>
                <button
                  onClick={logout}
                  className="bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <ModalSelectPdf
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        onSelect={handleSelectPdf}
        pdfs={pdfs}
        title={modalType === 'activities' 
          ? "Selecciona el PDF para ver las actividades"
          : "Selecciona el PDF para usar las herramientas"}
      />
    </nav>
  );
}; 