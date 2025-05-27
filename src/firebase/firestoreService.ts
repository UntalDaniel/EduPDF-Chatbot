// src/firebase/firestoreService.ts
import { db, auth as firebaseAuthService } from './firebaseConfig';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp, FieldValue } from 'firebase/firestore';
import type { ExamForFirestore } from '../types/examTypes'; // <--- IMPORTANTE: Asegúrate que este tipo esté bien definido

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: 'docente' | 'alumno';
  createdAt: FieldValue | Timestamp;
  lastLoginAt?: FieldValue | Timestamp;
}

export const updateUserProfile = async (user: FirebaseUser, additionalData: Partial<UserProfile> = {}): Promise<void> => {
  if (!db) {
    console.error("Firestore (db) no está inicializado.");
    throw new Error("Firestore no está inicializado.");
  }
  if (!user) {
    console.error("Objeto User no proporcionado para updateUserProfile.");
    throw new Error("Usuario no proporcionado.");
  }
  const userDocRef = doc(db, 'usuarios', user.uid);
  try {
    const docSnap = await getDoc(userDocRef);
    let profileData: Partial<UserProfile>;
    const defaultDisplayName = user.displayName || emailToDisplayName(user.email) || 'Usuario Anónimo';
    if (docSnap.exists()) {
      profileData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || docSnap.data()?.displayName || defaultDisplayName,
        photoURL: user.photoURL || docSnap.data()?.photoURL,
        lastLoginAt: serverTimestamp(),
        ...additionalData,
      };
    } else {
      profileData = {
        uid: user.uid,
        email: user.email,
        displayName: additionalData.displayName || defaultDisplayName,
        photoURL: additionalData.photoURL || user.photoURL,
        role: additionalData.role || 'alumno', // Default role, adjust if needed
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...additionalData,
      };
    }
    await setDoc(userDocRef, profileData, { merge: true });
    console.log(`Perfil de usuario actualizado/creado para UID: ${user.uid}`);
  } catch (error) {
    console.error("Error al actualizar/crear perfil de usuario:", error);
    throw error; // Re-throw para que el llamador pueda manejarlo
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!db) {
    console.error("Firestore (db) no está inicializado.");
    return null;
  }
  const userDocRef = doc(db, 'usuarios', userId);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  } else {
    console.log(`No se encontró perfil para el usuario: ${userId}`);
    return null;
  }
};

const emailToDisplayName = (email: string | null): string | null => {
    if (!email) return null;
    return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export interface PdfMetadata {
  id?: string; // Firestore document ID, se añade al leer
  idDocente: string; // UID del docente que subió el PDF
  nombreArchivoOriginal: string;
  nombreEnStorage: string; // Nombre del archivo en Firebase Storage
  urlDescargaStorage: string;
  titulo?: string; // Título editable por el usuario
  descripcionCorta?: string;
  fechaSubida: FieldValue | Timestamp; // Usar FieldValue para escritura, Timestamp para lectura
  // Podrías añadir más campos como 'estadoProcesamientoIA', 'temasClave', etc.
}

export const savePdfMetadata = async (pdfData: Omit<PdfMetadata, 'id' | 'fechaSubida' | 'idDocente'>): Promise<string> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  if (!firebaseAuthService?.currentUser) throw new Error("Usuario no autenticado para guardar PDF.");
  
  const dataToSave: Omit<PdfMetadata, 'id'> = {
    ...pdfData,
    idDocente: firebaseAuthService.currentUser.uid,
    fechaSubida: serverTimestamp(),
  };

  const pdfsCollectionRef = collection(db, 'documentosPDF'); // Colección raíz para todos los PDFs
  const docRef = await addDoc(pdfsCollectionRef, dataToSave);
  console.log("Metadatos de PDF guardados con ID:", docRef.id);
  return docRef.id;
};

export const getPdfsByTeacher = async (teacherId: string): Promise<PdfMetadata[]> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const pdfsCollectionRef = collection(db, 'documentosPDF');
  const q = query(pdfsCollectionRef, where('idDocente', '==', teacherId));
  
  try {
    const querySnapshot = await getDocs(q);
    const pdfs: PdfMetadata[] = [];
    querySnapshot.forEach((doc) => {
      pdfs.push({ id: doc.id, ...doc.data() } as PdfMetadata);
    });
    console.log(`Encontrados ${pdfs.length} PDFs para el docente ${teacherId}`);
    return pdfs;
  } catch (error) {
    console.error(`Error obteniendo PDFs para el docente ${teacherId}:`, error);
    throw error;
  }
};

export const getPdfById = async (pdfId: string): Promise<PdfMetadata | null> => {
  if (!db) {
    console.error("Firestore (db) no está inicializado.");
    return null;
  }
  if (!pdfId) {
    console.error("No se proporcionó PDF ID para getPdfById.");
    return null;
  }
  // Asumimos que los PDFs están en una colección raíz 'documentosPDF'
  const pdfDocRef = doc(db, 'documentosPDF', pdfId);
  try {
    const docSnap = await getDoc(pdfDocRef);
    if (docSnap.exists()) {
      // Aquí podrías añadir lógica de permisos si es necesario,
      // por ejemplo, verificando si el currentUser.uid coincide con idDocente
      // if (firebaseAuthService.currentUser && docSnap.data().idDocente !== firebaseAuthService.currentUser.uid) {
      //   console.warn(`User ${firebaseAuthService.currentUser.uid} intentó acceder a PDF ${pdfId} que no le pertenece.`);
      //   return null; // O lanzar un error de permisos
      // }
      return { id: docSnap.id, ...docSnap.data() } as PdfMetadata;
    } else {
      console.log(`No se encontró PDF con ID: ${pdfId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener PDF con ID ${pdfId}:`, error);
    throw error; // Re-throw para que el llamador pueda manejarlo
  }
};

export const updatePdfMetadata = async (pdfId: string, dataToUpdate: Partial<PdfMetadata>): Promise<void> => {
    if (!db) throw new Error("Firestore no está inicializado.");
    const pdfDocRef = doc(db, 'documentosPDF', pdfId);
    // Aquí también podrías añadir una verificación de permisos antes de actualizar
    await updateDoc(pdfDocRef, dataToUpdate);
    console.log(`Metadatos del PDF ${pdfId} actualizados.`);
};

export const deletePdfMetadata = async (pdfId: string): Promise<void> => {
    if (!db) throw new Error("Firestore no está inicializado.");
    const pdfDocRef = doc(db, 'documentosPDF', pdfId);
    // Aquí también podrías añadir una verificación de permisos antes de eliminar
    await deleteDoc(pdfDocRef);
    console.log(`Metadatos del PDF ${pdfId} eliminados de Firestore.`);
};

// --- NUEVA FUNCIÓN PARA GUARDAR EXÁMENES ---
export const saveExamToFirestore = async (userId: string, examData: ExamForFirestore): Promise<string> => {
  if (!userId) {
    console.error("User ID es requerido para guardar un examen.");
    throw new Error("User ID es requerido para guardar un examen.");
  }
  if (!db) {
    console.error("Firestore (db) no está inicializado.");
    throw new Error("Firestore no está inicializado.");
  }
  if (!examData || !examData.questions || examData.questions.length === 0) {
    console.error("Datos del examen inválidos o sin preguntas.");
    throw new Error("Datos del examen inválidos o sin preguntas.");
  }

  try {
    // La propiedad 'createdAt' ya se añade con serverTimestamp() en CreateExamScreen.tsx
    // antes de llamar a esta función. Si no fuera así, se añadiría aquí:
    // const dataToSave = { ...examData, createdAt: serverTimestamp() };
    
    // Guardar en una subcolección 'exams' dentro del documento del usuario en la colección 'usuarios'
    const examsCollectionRef = collection(db, 'usuarios', userId, 'exams');
    const docRef = await addDoc(examsCollectionRef, examData);
    
    console.log(`Examen guardado con ID: ${docRef.id} para el usuario ${userId}`);
    return docRef.id;
  } catch (error) {
    console.error(`Error guardando examen en Firestore para el usuario ${userId}:`, error);
    // Podrías lanzar un error más específico o formateado si quieres
    throw new Error("No se pudo guardar el examen en la base de datos.");
  }
};
