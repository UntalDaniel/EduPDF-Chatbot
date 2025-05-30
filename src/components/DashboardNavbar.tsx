import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Users, FileText, List, Puzzle, Wrench, UserCircle, LogOut, BookOpen } from 'lucide-react';
import ModalSelectPdf from './ModalSelectPdf';
import { useEffect, useState } from 'react';
import { getPdfsByTeacher } from '../firebase/firestoreService';
import type { PdfMetadata } from '../firebase/firestoreService';

const DashboardNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'activities' | 'tools' | null>(null);
  const [pdfs, setPdfs] = useState<PdfMetadata[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  useEffect(() => {
    const fetchPdfs = async () => {
      if (user) {
        setLoadingPdfs(true);
        try {
          const pdfList = await getPdfsByTeacher(user.uid);
          setPdfs(pdfList);
        } catch (e) {
          setPdfs([]);
        } finally {
          setLoadingPdfs(false);
        }
      }
    };
    fetchPdfs();
  }, [user]);

  const handleNavClick = (type: 'activities' | 'tools') => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleSelectPdf = (pdfId: string) => {
    setModalOpen(false);
    if (modalType === 'activities') {
      navigate(`/dashboard/activities/${pdfId}`);
    } else if (modalType === 'tools') {
      navigate(`/dashboard/tools/${pdfId}`);
    }
    setModalType(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 shadow-lg sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2 text-sky-400 font-bold text-2xl hover:text-sky-300 transition-colors">
            <BookOpen className="w-7 h-7" /> EduPDF
          </Link>
          {user && (
            <>
              <Link
                to="/dashboard/groups"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                  location.pathname === '/dashboard/groups' || location.pathname.startsWith('/dashboard/groups/')
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Grupos</span>
              </Link>
              <Link 
                to="/dashboard/my-forms" 
                className={`flex items-center gap-1 text-base font-medium hover:text-sky-300 transition-colors ${
                  location.pathname.startsWith('/dashboard/my-forms') ? 'text-sky-300' : 'text-sky-100'
                }`}
              >
                <FileText className="w-5 h-5 mr-1" /> Mis Formatos
              </Link>
              <Link 
                to="/dashboard/my-saved-exams" 
                className={`flex items-center gap-1 text-base font-medium hover:text-sky-300 transition-colors ${
                  location.pathname.startsWith('/dashboard/my-saved-exams') ? 'text-sky-300' : 'text-sky-100'
                }`}
              >
                <List className="w-5 h-5 mr-1" /> Mis Exámenes Guardados
              </Link>
              <button 
                type="button" 
                onClick={() => handleNavClick('activities')} 
                className={`flex items-center gap-1 text-base font-medium hover:text-sky-300 transition-colors bg-transparent border-0 p-0 m-0 ${
                  location.pathname.startsWith('/dashboard/activities') ? 'text-sky-300' : 'text-sky-100'
                }`}
              >
                <Puzzle className="w-5 h-5 mr-1" /> Actividades
              </button>
              <button 
                type="button" 
                onClick={() => handleNavClick('tools')} 
                className={`flex items-center gap-1 text-base font-medium hover:text-sky-300 transition-colors bg-transparent border-0 p-0 m-0 ${
                  location.pathname.startsWith('/dashboard/tools') ? 'text-sky-300' : 'text-sky-100'
                }`}
              >
                <Wrench className="w-5 h-5 mr-1" /> Herramientas
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
              <UserCircle className="w-5 h-5 text-sky-400" />
              <span className="text-sky-100 font-medium">{user.displayName || user.email?.split('@')[0] || 'Usuario'}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 text-base shadow-md transition-all duration-200"
          >
            <LogOut className="w-5 h-5" /> Salir
          </button>
        </div>
      </div>
      <ModalSelectPdf
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelectPdf}
        pdfs={pdfs}
        title={modalType === 'activities' ? 'Selecciona un PDF para Actividades' : 'Selecciona un PDF para Herramientas'}
      />
    </nav>
  );
};

export default DashboardNavbar; 