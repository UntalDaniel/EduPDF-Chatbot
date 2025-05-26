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
        role: additionalData.role || 'alumno',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...additionalData,
      };
    }
    await setDoc(userDocRef, profileData, { merge: true });
    console.log(`Perfil de usuario actualizado/creado para UID: ${user.uid}`);
  } catch (error) {
    console.error("Error al actualizar/crear perfil de usuario:", error);
    throw error;
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
  id?: string;
  idDocente: string;
  nombreArchivoOriginal: string;
  nombreEnStorage: string; 
  urlDescargaStorage: string;
  titulo?: string;
  descripcionCorta?: string;
  fechaSubida: FieldValue | Timestamp;
}

export const savePdfMetadata = async (pdfData: Omit<PdfMetadata, 'id' | 'fechaSubida' | 'idDocente'>): Promise<string> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  if (!firebaseAuthService?.currentUser) throw new Error("Usuario no autenticado para guardar PDF.");
  const dataToSave: Omit<PdfMetadata, 'id'> = {
    ...pdfData,
    idDocente: firebaseAuthService.currentUser.uid,
    fechaSubida: serverTimestamp(),
  };
  const pdfsCollectionRef = collection(db, 'documentosPDF');
  const docRef = await addDoc(pdfsCollectionRef, dataToSave);
  console.log("Metadatos de PDF guardados con ID:", docRef.id);
  return docRef.id;
};

export const getPdfsByTeacher = async (teacherId: string): Promise<PdfMetadata[]> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const pdfsCollectionRef = collection(db, 'documentosPDF');
  const q = query(pdfsCollectionRef, where('idDocente', '==', teacherId));
  const querySnapshot = await getDocs(q);
  const pdfs: PdfMetadata[] = [];
  querySnapshot.forEach((doc) => {
    pdfs.push({ id: doc.id, ...doc.data() } as PdfMetadata);
  });
  console.log(`Encontrados ${pdfs.length} PDFs para el docente ${teacherId}`);
  return pdfs;
};

// Nueva función para obtener un PDF por su ID
export const getPdfById = async (pdfId: string): Promise<PdfMetadata | null> => {
  if (!db) {
    console.error("Firestore (db) no está inicializado.");
    return null;
  }
  if (!pdfId) {
    console.error("No se proporcionó PDF ID.");
    return null;
  }
  const pdfDocRef = doc(db, 'documentosPDF', pdfId);
  try {
    const docSnap = await getDoc(pdfDocRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PdfMetadata;
    } else {
      console.log(`No se encontró PDF con ID: ${pdfId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener PDF con ID ${pdfId}:`, error);
    throw error;
  }
};

export const updatePdfMetadata = async (pdfId: string, dataToUpdate: Partial<PdfMetadata>): Promise<void> => {
    if (!db) throw new Error("Firestore no está inicializado.");
    const pdfDocRef = doc(db, 'documentosPDF', pdfId);
    await updateDoc(pdfDocRef, dataToUpdate);
    console.log(`Metadatos del PDF ${pdfId} actualizados.`);
};

export const deletePdfMetadata = async (pdfId: string): Promise<void> => {
    if (!db) throw new Error("Firestore no está inicializado.");
    const pdfDocRef = doc(db, 'documentosPDF', pdfId);
    await deleteDoc(pdfDocRef);
    console.log(`Metadatos del PDF ${pdfId} eliminados de Firestore.`);
};
