// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardNavbar from '@/components/DashboardNavbar';
import { auth as firebaseAuthInstance } from './firebase/firebaseConfig';

// Importa tus componentes de pantalla
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TeacherDashboard from './screens/TeacherDashboard';
import CreateActivityScreen from './screens/CreateActivityScreen';
import ChatWithPdfScreen from './screens/ChatWithPdfScreen';
import CreateExamScreen from './screens/CreateExamScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import AssignExamToGroups from './screens/AssignExamToGroups';
import AssignedExamsView from './screens/AssignedExamsView';
import GradesDashboard from './screens/GradesDashboard';
import MyFormsScreen from './screens/MyFormsScreen';
import MySavedExamsScreen from './screens/MySavedExamsScreen';
import FormDetailScreen from './screens/FormDetailScreen';
import GroupExamDetailScreen from './screens/GroupExamDetailScreen';
import StudentExamAttemptDetailScreen from './screens/StudentExamAttemptDetailScreen';
import ToolsScreen from './screens/ToolsScreen';
import ActivitiesScreen from './screens/ActivitiesScreen';
import TakeExamScreen from './screens/TakeExamScreen';
import NotFoundScreen from './screens/NotFoundScreen';

// Componente de diseño principal que incluye la barra de navegación
const MainLayout = () => {
  const location = useLocation();
  const isExamRoute = location.pathname.includes('/create-exam/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 font-sans">
      {!isExamRoute && <DashboardNavbar />}
      <main className={`container mx-auto p-4 ${!isExamRoute ? 'pt-20' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};

// Componente para manejar la ruta de exámenes públicos
const PublicExamRoute = () => {
  return (
    <Routes>
      <Route path=":examId" element={<TakeExamScreen />} />
    </Routes>
  );
};

// Componente para rutas protegidas
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
        <p className="text-xl font-semibold text-slate-300">Verificando Acceso...</p>
      </div>
    );
  }
  
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// Componente para rutas públicas
const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
        <p className="text-xl font-semibold text-slate-300">Cargando Página...</p>
      </div>
    );
  }
  
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

const App: React.FC = () => {
  const auth = firebaseAuthInstance;
  
  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error de Configuración</h1>
        <p className="text-lg text-slate-300 mb-4">No se pudo inicializar el servicio de autenticación.</p>
        <p className="text-md">Verifica la configuración de Firebase o contacta al soporte.</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route path="dashboard" element={<ProtectedRoute />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="groups" element={<GroupsScreen />} />
          <Route path="groups/:groupId" element={<GroupDetailScreen />} />
          <Route path="groups/:groupId/exam/:examId" element={<GroupExamDetailScreen />} />
          <Route path="assign-exam/:examId" element={<AssignExamToGroups />} />
          <Route path="assigned-exams/:groupId" element={<AssignedExamsView />} />
          <Route path="my-forms" element={<MyFormsScreen />} />
          <Route path="my-saved-exams" element={<MySavedExamsScreen />} />
          <Route path="chat/:pdfId" element={<ChatWithPdfScreen />} />
          <Route path="tools/:pdfId" element={<ToolsScreen />} />
          <Route path="activities/:pdfId" element={<ActivitiesScreen />} />
          <Route path="create-exam/:pdfId" element={<CreateExamScreen />} />
        </Route>
        <Route path="login" element={<PublicRoute />}>
          <Route index element={<LoginScreen />} />
        </Route>
        <Route path="register" element={<PublicRoute />}>
          <Route index element={<RegisterScreen />} />
        </Route>
        <Route path="public/exam/*" element={<PublicExamRoute />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
};

export default App;
