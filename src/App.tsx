// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { app as firebaseAppInstance, auth as firebaseAuthInstance } from './firebase/firebaseConfig';

// Importa tus componentes de pantalla
import AuthScreen from './screens/AuthScreen';
import TeacherDashboard from './screens/TeacherDashboard';
import CreateActivityScreen from './screens/CreateActivityScreen';
import ChatWithPdfScreen from './screens/ChatWithPdfScreen';
import CreateExamScreen from './screens/CreateExamScreen'; // <--- IMPORTACIÓN NUEVA

import { AlertTriangle, Home, Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = firebaseAuthInstance;

  useEffect(() => {
    if (!auth) {
        console.warn("ProtectedRoute: Auth service not available. Cannot determine auth state.");
        setLoading(false); 
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => { 
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, [auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
        <p className="text-xl font-semibold text-slate-300">Verificando Acceso...</p>
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/auth" replace />;
};

const PublicRoute: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = firebaseAuthInstance;

  useEffect(() => {
     if (!auth) {
        console.warn("PublicRoute: Auth service not available. Cannot determine auth state.");
        setLoading(false); 
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => { 
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, [auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
        <p className="text-xl font-semibold text-slate-300">Cargando Página...</p>
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

const NavigateBasedOnAuth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthAttempted, setInitialAuthAttempted] = useState(false);
  const auth = firebaseAuthInstance;

  useEffect(() => {
    if (!auth) {
        console.warn("NavigateBasedOnAuth: Auth service not available. Cannot perform initial auth.");
        setLoading(false);
        setInitialAuthAttempted(true); 
        return;
    }

    const attemptInitialAuth = async () => {
        if (auth.currentUser) {
            console.log("NavigateBasedOnAuth: User already available on mount or from previous token sign-in.", auth.currentUser.uid);
            setInitialAuthAttempted(true);
            // No es necesario llamar a setLoading(false) aquí porque onAuthStateChanged lo hará.
            return;
        }

        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        if (initialAuthToken) {
            try {
                console.log("NavigateBasedOnAuth: Attempting signInWithCustomToken...");
                await signInWithCustomToken(auth, initialAuthToken);
            } catch (error) {
                console.error("NavigateBasedOnAuth: Error with signInWithCustomToken, trying anonymous:", error);
                if (!auth.currentUser) { // Solo intentar anónimo si signInWithCustomToken falló Y no hay usuario
                    try { await signInAnonymously(auth); } catch (e) { console.error("Anon sign-in failed after custom token error", e); }
                }
            }
        } else { 
            try {
                console.log("NavigateBasedOnAuth: No custom token and no current user, attempting signInAnonymously...");
                if (!auth.currentUser) { // Solo intentar anónimo si realmente no hay usuario
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("NavigateBasedOnAuth: Error with signInAnonymously:", error);
            }
        }
        setInitialAuthAttempted(true); // Marcar que el intento inicial se hizo
        // onAuthStateChanged se encargará de setUser y setLoading(false)
    };

    if (!initialAuthAttempted) { // Solo ejecutar una vez
        attemptInitialAuth();
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => { 
      setUser(currentUser);
      setLoading(false); // Asegurar que loading se ponga en false después del primer chequeo de auth
    });
    return () => unsubscribe();
  }, [initialAuthAttempted, auth]); // Depender de initialAuthAttempted para que no se re-ejecute innecesariamente

  if (loading || !initialAuthAttempted) { 
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <Loader2 className="animate-spin h-8 w-8 text-sky-400 mr-3" />
            <p>Inicializando Aplicación...</p>
        </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />;
};

const App: React.FC = () => {
  if (!firebaseAppInstance || !firebaseAuthInstance) {
    return (
      <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-yellow-300 mb-6" />
        <h1 className="text-3xl font-bold mb-3">Error Crítico de Aplicación</h1>
        <p className="text-lg mb-2">Fallo al inicializar Firebase.</p>
        <p className="text-md">Verifica la configuración de Firebase o contacta al soporte.</p>
        <p className="text-sm text-yellow-200 mt-6">Revisa la consola del navegador para más detalles técnicos.</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<PublicRoute />}>
          <Route index element={<AuthScreen />} />
        </Route>
        
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="create-activity/:pdfId" element={<CreateActivityScreen />} />
          <Route path="chat/:pdfId" element={<ChatWithPdfScreen />} /> 
          <Route path="create-exam/:pdfId" element={<CreateExamScreen />} /> {/* <-- RUTA AÑADIDA --> */}
        </Route>
        
        <Route path="/" element={<NavigateBasedOnAuth />} />
        
        <Route path="*" element={
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
            <AlertTriangle className="h-16 w-16 text-yellow-400 mb-5" />
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-xl text-slate-300 mb-6">Página No Encontrada</p>
            <Link 
                to="/" 
                className="mt-4 px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition-colors flex items-center shadow-lg"
            >
              <Home size={20} className="mr-2" />
              Volver al Inicio
            </Link>
          </div>
        } />
      </Routes>
    </Router>
  );
};

export default App;
