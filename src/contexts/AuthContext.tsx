import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  signInAnonymously as firebaseSignInAnonymously,
  applyActionCode,
  AuthError,
  AuthErrorCodes,
  UserCredential,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { 
  createUserProfile, 
  getUserProfile, 
  updateUserProfile,
  updateLastLogin,
  UserProfile,
  UserRole
} from '../firebase/userService';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  error: string | null;
};

type AuthContextType = AuthState & {
  // Auth methods
  login: (email: string, password: string) => Promise<FirebaseUser | void>;
  register: (email: string, password: string, displayName: string) => Promise<FirebaseUser | void>;
  loginWithGoogle: () => Promise<FirebaseUser | void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  sendVerificationEmail: () => Promise<{ success: boolean; message: string }>;
  verifyEmail: (oobCode: string) => Promise<{ success: boolean; message: string }>;
  signInAnonymously: () => Promise<FirebaseUser | void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const mapFirebaseErrorToMessage = (error: AuthError): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'El correo electrónico ya está en uso';
    case 'auth/invalid-email':
      return 'Correo electrónico inválido';
    case 'auth/user-not-found':
      return 'Usuario no encontrado';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Inténtalo de nuevo más tarde';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres';
    case 'auth/operation-not-allowed':
      return 'Esta operación no está permitida. Contacta al soporte';
    default:
      console.error('Código de error no manejado:', error.code, error.message);
      return error.message || 'Ocurrió un error inesperado';
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    isEmailVerified: false,
    currentUser: null,
    userProfile: null,
    error: null,
  });

  const setError = (error: string | null) => {
    setAuthState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  };

  const setLoading = (isLoading: boolean) => {
    setAuthState(prev => ({
      ...prev,
      isLoading,
      error: isLoading ? prev.error : null // Clear error when loading starts
    }));
  };

  // Cargar el perfil del usuario
  const loadUserProfile = useCallback(async (user: FirebaseUser) => {
    try {
      let userProfile = await getUserProfile(user.uid);
      
      // Si el perfil no existe, lo creamos
      if (!userProfile) {
        userProfile = await createUserProfile({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        });
      } else if (!user.displayName && userProfile.displayName) {
        // Actualizar el perfil de autenticación si no tiene displayName
        await updateProfile(user, {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || undefined
        });
      }

      // Actualizar el último inicio de sesión
      await updateLastLogin(user.uid);

      return userProfile;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }, []);

  // Manejar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Verificar si es un usuario anónimo
          if (user.isAnonymous) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              isEmailVerified: false,
              currentUser: user,
              userProfile: null,
              error: null
            });
            return;
          }
          
          // Para usuarios regulares, cargar el perfil
          try {
            const userProfile = await loadUserProfile(user);
            
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              isEmailVerified: user.emailVerified,
              currentUser: user,
              userProfile,
              error: null
            });
          } catch (profileError) {
            console.error('Error loading user profile:', profileError);
            // Si hay un error al cargar el perfil, forzar cierre de sesión
            await firebaseSignOut(auth);
            setError('Error al cargar el perfil del usuario. Por favor, inicia sesión nuevamente.');
          }
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            isEmailVerified: false,
            currentUser: null,
            userProfile: null,
            error: null
          });
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setError('Error al cargar la sesión del usuario');
        // Forzar estado de no autenticado en caso de error
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          isEmailVerified: false,
          currentUser: null,
          userProfile: null,
          error: 'Error al cargar la sesión del usuario'
        });
      }
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  // Iniciar sesión con correo y contraseña
  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const userCredential = await firebaseSignInWithEmailAndPassword(auth, email, password);
      const userProfile = await loadUserProfile(userCredential.user);
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isEmailVerified: userCredential.user.emailVerified,
        currentUser: userCredential.user,
        userProfile,
        isLoading: false
      }));
      
      return userCredential.user;
    } catch (error: any) {
      const errorMessage = mapFirebaseErrorToMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Registrar nuevo usuario
  const register = async (email: string, password: string, displayName: string) => {
    setError(null);
    setLoading(true);
    
    try {
      // Validar que el correo no esté en uso
      const methods = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${import.meta.env.VITE_FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          continueUri: window.location.origin
        })
      });
      
      const data = await methods.json();
      
      if (data.registered === true) {
        throw new Error('auth/email-already-in-use');
      }
      
      // Crear el usuario
      const userCredential = await firebaseCreateUserWithEmailAndPassword(auth, email, password);
      const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
      
      try {
        // Actualizar el perfil de autenticación
        await updateProfile(userCredential.user, {
          displayName,
          photoURL
        });
        
        // Crear el perfil del usuario en Firestore
        const userProfileData = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName,
          photoURL,
          emailVerified: userCredential.user.emailVerified,
          role: 'student' as const, // Rol por defecto
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const userProfile = await createUserProfile(userProfileData);
        
        // Enviar correo de verificación
        try {
          await firebaseSendEmailVerification(userCredential.user);
          
          // Actualizar el estado con el usuario recién creado
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            isEmailVerified: false,
            currentUser: { ...userCredential.user, displayName, photoURL },
            userProfile,
            error: null
          });
          
          return userCredential.user;
          
        } catch (verificationError) {
          console.error('Error al enviar correo de verificación:', verificationError);
          // No lanzamos error, solo lo registramos
        }
        
        return userCredential.user;
        
      } catch (profileError) {
        console.error('Error al actualizar el perfil:', profileError);
        // Si hay un error al actualizar el perfil, eliminamos el usuario creado
        await userCredential.user.delete();
        throw new Error('Error al configurar el perfil del usuario');
      }
      
    } catch (error: any) {
      console.error('Error en el registro:', error);
      const errorMessage = mapFirebaseErrorToMessage(
        error.code ? error : { code: error.message || 'auth/unknown-error' }
      );
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        isEmailVerified: false,
        currentUser: null,
        userProfile: null,
        error: null
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setError('Error al cerrar sesión');
    }
  };

  // Iniciar sesión con Google
  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userProfile = await loadUserProfile(result.user);
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isEmailVerified: result.user.emailVerified,
        currentUser: result.user,
        userProfile,
        isLoading: false
      }));
      
      return result.user;
    } catch (error: any) {
      const errorMessage = mapFirebaseErrorToMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Restablecer contraseña
  const resetPassword = async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      return { 
        success: true, 
        message: 'Se ha enviado un correo con instrucciones para restablecer tu contraseña' 
      };
    } catch (error: any) {
      const errorMessage = mapFirebaseErrorToMessage(error);
      setError(errorMessage);
      return { 
        success: false, 
        message: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  };

  // Enviar correo de verificación
  const sendVerificationEmail = async () => {
    if (!authState.currentUser) {
      return { success: false, message: 'No hay usuario autenticado' };
    }

    try {
      await firebaseSendEmailVerification(authState.currentUser);
      return { success: true, message: 'Correo de verificación enviado' };
    } catch (error: any) {
      return { success: false, message: mapFirebaseErrorToMessage(error) };
    }
  };

  // Verificar correo electrónico
  const verifyEmail = async (oobCode: string) => {
    try {
      await applyActionCode(auth, oobCode);
      return { success: true, message: 'Correo verificado correctamente' };
    } catch (error: any) {
      return { success: false, message: mapFirebaseErrorToMessage(error) };
    }
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setAuthState(prev => ({
        ...prev,
        currentUser: auth.currentUser,
        isEmailVerified: auth.currentUser?.emailVerified || false
      }));
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!authState.currentUser) return;
    
    try {
      // Usar el método de userService para actualizar el perfil
      const { updateUserProfile } = await import('../firebase/userService');
      await updateUserProfile(authState.currentUser.uid, updates);
      setAuthState(prev => ({
        ...prev,
        userProfile: { ...prev.userProfile, ...updates } as UserProfile
      }));
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  };

  // Iniciar sesión anónimamente
  const signInAnonymously = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await firebaseSignInAnonymously(auth);
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isEmailVerified: false,
        currentUser: result.user,
        userProfile: null,
        isLoading: false
      }));
      
      return result.user;
    } catch (error: any) {
      const errorMessage = mapFirebaseErrorToMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Crear el valor del contexto
  const contextValue: AuthContextType = {
    ...authState,
    login: async (email: string, password: string) => {
      const user = await login(email, password);
      return user || undefined;
    },
    register: async (email: string, password: string, displayName: string) => {
      const user = await register(email, password, displayName);
      return user || undefined;
    },
    loginWithGoogle: async () => {
      const user = await loginWithGoogle();
      return user || undefined;
    },
    logout,
    resetPassword,
    sendVerificationEmail,
    verifyEmail,
    signInAnonymously: async () => {
      const user = await signInAnonymously();
      return user || undefined;
    },
    clearError,
    refreshUser,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
