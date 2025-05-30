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
  Timestamp,
  FieldValue,
  orderBy
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { ExamForFirestore } from '../types/examTypes'; // <--- IMPORTANTE: Asegúrate que este tipo esté bien definido
import { ActivityTypeActivity, ActivityAttempt } from '../types/activityTypes';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: 'docente' | 'alumno';
  createdAt: Timestamp | FieldValue;
  lastLoginAt?: Timestamp | FieldValue;
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
  fechaSubida: Timestamp | FieldValue; // Usar FieldValue para escritura, Timestamp para lectura
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
export const saveExamToFirestore = async (exam: ExamForFirestore): Promise<void> => {
    if (!db) throw new Error('Firestore no está inicializado');
    
    const examRef = doc(db, 'exams', exam.id);
    const examData = {
        ...exam,
        created_at: exam.created_at
    };
    await setDoc(examRef, examData);
};

// --- CRUD de Grupos de Docente ---

export interface TeacherGroup {
  id?: string; // Firestore document ID
  name: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

// Obtener todos los grupos de un docente
export const getGroupsByTeacher = async (teacherId: string): Promise<TeacherGroup[]> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const groupsCollectionRef = collection(db, `usuarios/${teacherId}/groups`);
  const q = query(groupsCollectionRef);
  try {
    const querySnapshot = await getDocs(q);
    const groups: TeacherGroup[] = [];
    querySnapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() } as TeacherGroup);
    });
    return groups;
  } catch (error) {
    console.error(`Error obteniendo grupos para el docente ${teacherId}:`, error);
    throw error;
  }
};

// Crear un grupo
export const createGroup = async (teacherId: string, groupName: string): Promise<string> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const groupsCollectionRef = collection(db, `usuarios/${teacherId}/groups`);
  const newGroup = {
    name: groupName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(groupsCollectionRef, newGroup);
  return docRef.id;
};

// Editar nombre de grupo
export const updateGroup = async (teacherId: string, groupId: string, newName: string): Promise<void> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const groupDocRef = doc(db, `usuarios/${teacherId}/groups/${groupId}`);
  await updateDoc(groupDocRef, {
    name: newName,
    updatedAt: serverTimestamp(),
  });
};

// Eliminar grupo
export const deleteGroup = async (teacherId: string, groupId: string): Promise<void> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const groupDocRef = doc(db, `usuarios/${teacherId}/groups/${groupId}`);
  await deleteDoc(groupDocRef);
};

// --- ASIGNACIÓN DE EXÁMENES A GRUPOS ---

export interface ExamAssignment {
  id?: string;
  examId: string;
  groupId: string;
  teacherId: string;
  startDate?: Timestamp | FieldValue;
  endDate?: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
}

// Asignar un examen a uno o varios grupos
export const assignExamToGroups = async (
  teacherId: string,
  examId: string,
  groupIds: string[],
  startDate?: Date,
  endDate?: Date
): Promise<void> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const batch = [];
  for (const groupId of groupIds) {
    // Solo incluir startDate y endDate si existen
    const assignment: any = {
      examId,
      groupId,
      teacherId,
      createdAt: serverTimestamp(),
    };
    if (startDate) assignment.startDate = Timestamp.fromDate(startDate);
    if (endDate) assignment.endDate = Timestamp.fromDate(endDate);
    batch.push(addDoc(collection(db, 'exams_assigned'), assignment));
  }
  await Promise.all(batch);
};

// Obtener exámenes asignados a un grupo
export const getAssignedExamsByGroup = async (groupId: string): Promise<ExamAssignment[]> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const q = query(collection(db, 'exams_assigned'), where('groupId', '==', groupId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAssignment));
};

// Obtener grupos a los que está asignado un examen
export const getAssignedGroupsByExam = async (examId: string): Promise<ExamAssignment[]> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  const q = query(collection(db, 'exams_assigned'), where('examId', '==', examId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAssignment));
};

// Desasignar un examen de un grupo
export const unassignExamFromGroup = async (assignmentId: string): Promise<void> => {
  if (!db) throw new Error("Firestore no está inicializado.");
  await deleteDoc(doc(db, 'exams_assigned', assignmentId));
};

// Obtener preguntas del examen a partir del assignmentId
export const getExamQuestionsByAssignment = async (assignmentId: string) => {
  if (!db) throw new Error('Firestore no inicializado');
  // Buscar el documento de asignación
  const assignmentRef = doc(db, 'exams_assigned', assignmentId);
  const assignmentSnap = await getDoc(assignmentRef);
  if (!assignmentSnap.exists()) throw new Error('Asignación no encontrada');
  const assignmentData = assignmentSnap.data();
  const examId = assignmentData.examId;
  if (!examId) throw new Error('No se encontró examId en la asignación');
  // Buscar el examen real
  const examRef = doc(db, 'exams', examId);
  const examSnap = await getDoc(examRef);
  if (!examSnap.exists()) throw new Error('Examen no encontrado');
  const examData = examSnap.data();
  // Se espera que examData.preguntas sea un array
  return examData.preguntas || [];
};

// Guardar intento de examen del estudiante con calificación automática
export const saveStudentExamAttempt = async (
  studentId: string,
  assignmentId: string,
  answers: any,
  extraData: { examId: string, groupId: string }
): Promise<{ score: number, total: number, feedback: any[] }> => {
  if (!db) throw new Error('Firestore no inicializado');

  // Obtener preguntas reales para calificar
  const examRef = doc(db, 'exams', extraData.examId);
  const examSnap = await getDoc(examRef);
  if (!examSnap.exists()) throw new Error('Examen no encontrado para calificación');
  const examData = examSnap.data();
  const preguntas = examData.preguntas || [];

  let score = 0;
  let total = 0;
  const feedback: any[] = [];

  preguntas.forEach((q: any) => {
    const respuestaEstudiante = answers[q.id];
    let correcto = null;
    if (['vf', 'opcion_multiple', 'completar'].includes(q.tipo) && q.respuestaCorrecta !== undefined) {
      total++;
      correcto = respuestaEstudiante === q.respuestaCorrecta;
      if (correcto) score++;
    }
    feedback.push({
      id: q.id,
      tipo: q.tipo,
      enunciado: q.enunciado,
      respuestaEstudiante,
      respuestaCorrecta: q.respuestaCorrecta,
      correcto,
    });
  });

  await setDoc(doc(db, `usuarios/${studentId}/examAttempts/${assignmentId}`), {
    answers,
    examId: extraData.examId,
    groupId: extraData.groupId,
    submittedAt: serverTimestamp(),
    status: 'completado',
    score,
    total,
    feedback,
  });

  return { score, total, feedback };
};

// Funciones para actividades
const activitiesCollection = collection(db, 'activities');

export const firestoreService = {
  async getActivities(): Promise<ActivityTypeActivity[]> {
    const snapshot = await getDocs(activitiesCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ActivityTypeActivity[];
  },

  async getActivity(id: string): Promise<ActivityTypeActivity | null> {
    const docRef = doc(activitiesCollection, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as ActivityTypeActivity;
  },

  async createActivity(activity: Omit<ActivityTypeActivity, 'id'>): Promise<string> {
    const docRef = await addDoc(activitiesCollection, {
      ...activity,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  async updateActivity(id: string, activity: Partial<ActivityTypeActivity>): Promise<void> {
    const docRef = doc(activitiesCollection, id);
    await updateDoc(docRef, {
      ...activity,
      updatedAt: Timestamp.now()
    });
  },

  async deleteActivity(id: string): Promise<void> {
    const docRef = doc(activitiesCollection, id);
    await deleteDoc(docRef);
  },

  async getActivitiesByPdfId(pdfId: string): Promise<ActivityTypeActivity[]> {
    const q = query(activitiesCollection, where('pdfId', '==', pdfId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ActivityTypeActivity[];
  },

  async getActivitiesByUserId(userId: string): Promise<ActivityTypeActivity[]> {
    const q = query(activitiesCollection, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ActivityTypeActivity[];
  }
};

export const saveActivityAttempt = async (
  userId: string,
  activityId: string,
  attempt: Omit<ActivityAttempt, 'id'>
): Promise<void> => {
  if (!db) throw new Error('Firestore no está inicializado');
  
  const attemptsRef = collection(db, 'users', userId, 'activities', activityId, 'attempts');
  await addDoc(attemptsRef, {
    ...attempt,
    createdAt: Timestamp.now(),
  });
};

export const getActivityAttempts = async (
  userId: string,
  activityId: string
): Promise<ActivityAttempt[]> => {
  if (!db) throw new Error('Firestore no está inicializado');
  
  const attemptsRef = collection(db, 'users', userId, 'activities', activityId, 'attempts');
  const snapshot = await getDocs(attemptsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    startedAt: doc.data().startedAt.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  })) as ActivityAttempt[];
};
