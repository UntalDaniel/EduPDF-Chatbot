// src/screens/AuthScreen.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { auth as firebaseAuthInstance, canvasAppId } from '../firebase/firebaseConfig';
import type { User as FirebaseUserType } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { updateUserProfile } from '../firebase/firestoreService';
import { Mail, KeyRound, Eye, EyeOff, AlertTriangle, CheckCircle, BookOpen } from 'lucide-react';

const AuthScreen: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUserType | null>(null);
    const [showPwd, setShowPwd] = useState(false);
    const [initialAuthAttempted, setInitialAuthAttempted] = useState(false);

    useEffect(() => {
        const auth = firebaseAuthInstance;

        if (!auth) {
            console.error("AuthScreen: Instancia de Firebase Auth (auth) es null. No se puede proceder.");
            setError("Error crítico: Servicio de autenticación no disponible.");
            setLoading(false);
            setInitialAuthAttempted(true);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUserType | null) => {
            if (user) {
                try {
                    // CORRECCIÓN: Asegurarse de pasar null en lugar de undefined a Firestore
                    await updateUserProfile(user, { 
                        displayName: user.displayName || null, // Si es undefined, pasa null
                        photoURL: user.photoURL || null,     // Si es undefined, pasa null
                    });
                    setCurrentUser(user);
                } catch (profileError) {
                    console.error("AuthScreen: Error al actualizar perfil en Firestore:", profileError);
                    // Considerar mostrar un error más específico al usuario si la actualización del perfil falla.
                    // Por ejemplo, podrías establecer un estado de error aquí.
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
            if(!initialAuthAttempted) setInitialAuthAttempted(true);
        });

        if (!auth.currentUser && !initialAuthAttempted) {
            const attemptInitialSignIn = async () => {
                setLoading(true);
                const tokenFromGlobal = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

                if (tokenFromGlobal) {
                    try {
                        console.log("AuthScreen: Attempting signInWithCustomToken...");
                        await signInWithCustomToken(auth, tokenFromGlobal);
                    } catch (customTokenError) {
                        console.error("AuthScreen: Error con signInWithCustomToken, intentando anónimo:", customTokenError);
                        if (!auth.currentUser) {
                           try { 
                               console.log("AuthScreen: signInWithCustomToken failed, attempting signInAnonymously...");
                               await signInAnonymously(auth); 
                            }
                           catch (anonError) {
                             console.error("AuthScreen: Error con signInAnonymously (fallback):", anonError);
                             setError("Fallo al iniciar sesión anónimamente (fallback).");
                           }
                        }
                    }
                } else {
                    try {
                        if (!auth.currentUser) {
                           console.log("AuthScreen: No custom token, attempting signInAnonymously...");
                           await signInAnonymously(auth);
                        }
                    } catch (anonError) {
                        console.error("AuthScreen: Error con signInAnonymously (sin token inicial):", anonError);
                        setError("Fallo al iniciar sesión anónimamente.");
                    }
                }
                setInitialAuthAttempted(true);
            };
            attemptInitialSignIn();
        } else {
            if (initialAuthAttempted) {
                 setLoading(false);
            }
        }

        return () => unsubscribe();
    }, [initialAuthAttempted]);

    const handleAuthAction = async (event: FormEvent | undefined, actionType: 'email' | 'google') => {
        if (event) {
            event.preventDefault();
        }
        const auth = firebaseAuthInstance;
        if (!auth) {
            setError("Servicio de autenticación no está disponible.");
            setLoading(false);
            return;
        }
        setError(null);
        setLoading(true);
        try {
            if (actionType === 'email') {
                if (isLogin) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    // Cuando se crea un usuario, updateUserProfile se llamará desde onAuthStateChanged
                    await createUserWithEmailAndPassword(auth, email, password);
                }
            } else if (actionType === 'google') {
                const provider = new GoogleAuthProvider();
                // Después del popup, onAuthStateChanged se encargará de updateUserProfile
                await signInWithPopup(auth, provider);
            }
        } catch (err) {
            console.error(`AuthScreen: Error durante ${actionType} auth:`, err);
            if (err instanceof FirebaseError) setError(`Error (${err.code}): ${err.message}`);
            else if (err instanceof Error) setError(err.message);
            else setError("Ocurrió un error desconocido durante la autenticación.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleLogout = async () => {
        const auth = firebaseAuthInstance;
        if (!auth) {
            setError("Servicio de autenticación no disponible.");
            return;
        }
        setLoading(true);
        try {
            await firebaseSignOut(auth);
        } catch (e) {
            console.error("Error al cerrar sesión:", e);
            if (e instanceof FirebaseError) setError(e.message);
            else if (e instanceof Error) setError(e.message);
            else setError("Error desconocido al cerrar sesión");
        } finally {
            setLoading(false);
        }
    };

    if (loading && !initialAuthAttempted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
                 <svg className="animate-spin h-10 w-10 text-sky-400 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="text-white text-2xl font-semibold">Inicializando Autenticación...</div>
            </div>
        );
    }
    
    if (currentUser) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 p-6 text-white">
                <div className="bg-slate-600 bg-opacity-50 backdrop-filter backdrop-blur-lg shadow-xl rounded-xl p-8 max-w-md text-center">
                    <CheckCircle className="mx-auto text-green-400 h-16 w-16 mb-4" />
                    <h1 className="text-3xl font-bold mb-6 text-sky-300">¡Bienvenido a EduPDF!</h1>
                    <p className="mb-2 text-lg text-slate-200">Sesión iniciada como:</p>
                    <div className="my-4 p-3 bg-slate-700 rounded-md text-left">
                        <p className="mb-1 text-sm text-slate-300">Email:</p>
                        <p className="font-mono text-sky-400 text-sm break-all">{currentUser.email || "No disponible (Anónimo)"}</p>
                        <p className="mt-3 mb-1 text-sm text-slate-300">ID Usuario:</p>
                        <p className="font-mono text-sky-400 text-sm break-all">{currentUser.uid}</p>
                        {canvasAppId && 
                          <>
                            <p className="mt-3 mb-1 text-sm text-slate-300">App ID (Canvas):</p>
                            <p className="font-mono text-sky-400 text-sm break-all">{canvasAppId}</p>
                          </>
                        }
                    </div>
                     <button
                        onClick={handleLogout}
                        className="mt-8 w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col justify-center items-center p-4 font-sans">
            <div className="bg-slate-700 p-8 rounded-xl shadow-2xl w-full max-w-md text-white">
                <div className="text-center mb-8">
                    <BookOpen className="mx-auto text-sky-400 h-16 w-16 mb-2" />
                    <h1 className="text-4xl font-bold text-sky-400">EduPDF</h1>
                    <p className="text-slate-300">{isLogin ? 'Inicia Sesión' : 'Crea tu Cuenta'}</p>
                    {canvasAppId && <p className="text-xs text-slate-400 mt-1">App ID: {canvasAppId}</p>}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded-lg flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-red-400" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={(e) => handleAuthAction(e, 'email')} className="space-y-6">
                    <div>
                        <label htmlFor="email-authscreen" className="block text-sm font-medium text-slate-300 mb-1">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input id="email-authscreen" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                                placeholder="tu@email.com" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="password-authscreen" className="block text-sm font-medium text-slate-300 mb-1">
                            Contraseña
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input id="password-authscreen" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
                                placeholder="••••••••" />
                            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-sky-400">
                                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center">
                        {loading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>}
                        {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        className="text-sm text-sky-400 hover:text-sky-300 hover:underline">
                        {isLogin ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Inicia Sesión'}
                    </button>
                </div>
                <div className="my-6 flex items-center"><div className="flex-grow border-t border-slate-600"></div><span className="flex-shrink mx-4 text-slate-400 text-sm">O</span><div className="flex-grow border-t border-slate-600"></div></div>
                <button onClick={() => handleAuthAction(undefined, 'google')} disabled={loading}
                    className="w-full flex items-center justify-center bg-slate-800 border border-slate-600 hover:bg-slate-600/70 text-slate-200 font-semibold py-3 px-6 rounded-lg shadow-sm transition">
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.53-4.19 7.19-10.44 7.19-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    Continuar con Google
                </button>
            </div>
            <footer className="text-center text-sm text-slate-500 mt-8">
                &copy; {new Date().getFullYear()} EduPDF. Todos los derechos reservados.
            </footer>
        </div>
    );
};

export default AuthScreen;
