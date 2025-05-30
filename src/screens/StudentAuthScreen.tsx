import React, { useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut as firebaseSignOut, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { updateUserProfile } from '../firebase/firestoreService';
import { AlertCircle, Loader2, UserPlus, LogIn, CheckCircle, AlertTriangle, Mail, BookOpen } from 'lucide-react';
import { FirebaseError } from 'firebase/app';

const StudentAuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUserType | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [initialAuthAttempted, setInitialAuthAttempted] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Inicio de sesión
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await updateUserProfile(userCredential.user, { role: 'alumno' });
      } else {
        // Registro
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await updateUserProfile(userCredential.user, { 
          role: 'alumno',
          displayName: name
        });
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setError(
        err.code === 'auth/email-already-in-use' 
          ? 'Este correo ya está registrado. Por favor, inicia sesión.'
          : err.code === 'auth/invalid-email'
          ? 'Correo electrónico inválido.'
          : err.code === 'auth/weak-password'
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Correo o contraseña incorrectos.'
          : 'Error al autenticar. Por favor, intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err) {
      console.error('Error al enviar email de recuperación:', err);
      if (err instanceof FirebaseError) {
        setError(`Error (${err.code}): ${err.message}`);
      } else {
        setError('Error al enviar el email de recuperación');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerification = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await sendEmailVerification(currentUser);
      setVerificationEmailSent(true);
    } catch (err) {
      console.error('Error al enviar email de verificación:', err);
      if (err instanceof FirebaseError) {
        setError(`Error (${err.code}): ${err.message}`);
      } else {
        setError('Error al enviar el email de verificación');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-400 mb-2">
            {isLogin ? 'Iniciar Sesión' : 'Registro de Estudiante'}
          </h1>
          <p className="text-slate-400">
            {isLogin 
              ? 'Accede a tus exámenes asignados'
              : 'Crea tu cuenta de estudiante'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-700/30 text-red-300 border border-red-600/50 rounded-lg flex items-center">
            <AlertCircle className="mr-2 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                Nombre Completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Tu nombre completo"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : isLogin ? (
              <>
                <LogIn className="mr-2" size={18} />
                Iniciar Sesión
              </>
            ) : (
              <>
                <UserPlus className="mr-2" size={18} />
                Registrarse
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-sky-400 hover:text-sky-300 text-sm"
          >
            {isLogin 
              ? '¿No tienes cuenta? Regístrate aquí'
              : '¿Ya tienes cuenta? Inicia sesión aquí'
            }
          </button>
        </div>

        {!isResetPassword && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsResetPassword(true);
                setError(null);
              }}
              className="text-sm text-sky-400 hover:text-sky-300 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        {currentUser && !currentUser.emailVerified && (
          <div className="mt-6 p-4 bg-yellow-500/20 text-yellow-300 border border-yellow-500 rounded-lg">
            <p className="mb-2">Tu correo electrónico no está verificado.</p>
            <button
              onClick={handleEmailVerification}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded-lg transition-colors"
            >
              Enviar email de verificación
            </button>
          </div>
        )}

        {resetEmailSent && (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="bg-slate-700 p-8 rounded-xl shadow-2xl w-full max-w-md text-white text-center">
              <CheckCircle className="mx-auto text-green-400 h-16 w-16 mb-4" />
              <h2 className="text-2xl font-bold text-sky-300 mb-4">Email Enviado</h2>
              <p className="text-slate-300 mb-6">
                Se ha enviado un email a {email} con instrucciones para recuperar tu contraseña.
              </p>
              <button
                onClick={() => {
                  setIsResetPassword(false);
                  setResetEmailSent(false);
                  setError(null);
                }}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </div>
        )}

        {verificationEmailSent && (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="bg-slate-700 p-8 rounded-xl shadow-2xl w-full max-w-md text-white text-center">
              <CheckCircle className="mx-auto text-green-400 h-16 w-16 mb-4" />
              <h2 className="text-2xl font-bold text-sky-300 mb-4">Email de Verificación Enviado</h2>
              <p className="text-slate-300 mb-6">
                Se ha enviado un email de verificación a tu correo electrónico.
                Por favor, verifica tu cuenta para acceder a todas las funcionalidades.
              </p>
              <button
                onClick={() => setVerificationEmailSent(false)}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAuthScreen; 