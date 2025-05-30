import { db } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { ActivityTypeActivity, ActivityType, WordSearchData, CrosswordData, WordConnectionData } from '../types/activityTypes';
import { Firestore } from 'firebase/firestore';

const ACTIVITIES_COLLECTION = 'activities';
const RESULTS_COLLECTION = 'activity_results';

export interface ActivityResult {
  id?: string;
  activityId: string;
  userId: string;
  score: number;
  timeSpent: number;
  completedAt: Date;
}

function getDb(): Firestore {
  if (!db) throw new Error('Firebase Firestore no está inicializado correctamente');
  return db;
}

function deserializarMatriz(arr: string[] | string[][]): string[][] {
  if (!Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === 'string') {
    // Es un array de strings serializado
    return (arr as string[]).map(row => (row as string).split(''));
  }
  // Ya es string[][]
  return arr as string[][];
}

function deserializarActividad(actividad: any): any {
  if (actividad?.data) {
    if ('grid' in actividad.data && actividad.data.grid) {
      actividad.data.grid = deserializarMatriz(actividad.data.grid);
    }
    if ('solution' in actividad.data && actividad.data.solution) {
      actividad.data.solution = deserializarMatriz(actividad.data.solution);
    }
  }
  return actividad;
}

interface CreateActivityParams {
    type: ActivityType;
    title: string;
    description: string;
    pdfId: string;
    userId: string;
    data: WordSearchData | CrosswordData | WordConnectionData;
}

export const createActivity = async ({
    type,
    title,
    description,
    pdfId,
    userId,
    data
}: CreateActivityParams): Promise<string> => {
    // Validación del campo 'type'
    if (!type || !Object.values(ActivityType).includes(type)) {
        throw new Error("El campo 'type' de la actividad es inválido o está vacío. Por favor selecciona un tipo de actividad válido.");
    }
    try {
        // Serializar arrays anidados en data si existen
        let dataToSave = { ...data };
        if (dataToSave && typeof dataToSave === 'object') {
            if ('grid' in dataToSave && Array.isArray((dataToSave as any).grid)) {
                (dataToSave as any).grid = JSON.stringify((dataToSave as any).grid);
            }
            if ('solution' in dataToSave && Array.isArray((dataToSave as any).solution)) {
                (dataToSave as any).solution = JSON.stringify((dataToSave as any).solution);
            }
        }
        const activityData = {
            type,
            title,
            description,
            pdfId,
            userId,
            data: dataToSave,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), activityData);
        return docRef.id;
    } catch (error) {
        console.error('Error al crear actividad:', error);
        throw error;
    }
};

export const getActivities = async (): Promise<ActivityTypeActivity[]> => {
    try {
        const q = query(
            collection(db, ACTIVITIES_COLLECTION),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })) as ActivityTypeActivity[];
    } catch (error) {
        console.error('Error al obtener actividades:', error);
        throw error;
    }
};

export const getActivity = async (id: string): Promise<ActivityTypeActivity | null> => {
  const docRef = doc(getDb(), ACTIVITIES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return deserializarActividad({
    id: docSnap.id,
    ...docSnap.data()
  }) as ActivityTypeActivity;
};

export const updateActivity = async (
    activityId: string,
    updates: Partial<ActivityTypeActivity>
): Promise<void> => {
    try {
        const activityRef = doc(db, ACTIVITIES_COLLECTION, activityId);
        await updateDoc(activityRef, {
            ...updates,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error al actualizar actividad:', error);
        throw error;
    }
};

export const deleteActivity = async (activityId: string): Promise<void> => {
    try {
        const activityRef = doc(db, ACTIVITIES_COLLECTION, activityId);
        await deleteDoc(activityRef);
    } catch (error) {
        console.error('Error al eliminar actividad:', error);
        throw error;
    }
};

export const getActivitiesByPdf = async (pdfId: string): Promise<ActivityTypeActivity[]> => {
    try {
        const q = query(
            collection(db, ACTIVITIES_COLLECTION),
            where('pdfId', '==', pdfId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })) as ActivityTypeActivity[];
    } catch (error) {
        console.error('Error al obtener actividades del PDF:', error);
        throw error;
    }
};

export const getActivitiesByUser = async (userId: string): Promise<ActivityTypeActivity[]> => {
    try {
        const q = query(
            collection(db, ACTIVITIES_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })) as ActivityTypeActivity[];
    } catch (error) {
        console.error('Error al obtener actividades del usuario:', error);
        throw error;
    }
};

export const saveActivityResult = async (result: Omit<ActivityResult, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(getDb(), RESULTS_COLLECTION), {
    ...result,
    completedAt: Timestamp.now()
  });
  return docRef.id;
};

export const getUserResults = async (userId: string): Promise<ActivityResult[]> => {
  const q = query(
    collection(getDb(), RESULTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('completedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ActivityResult[];
};

export const getActivityResults = async (activityId: string): Promise<ActivityResult[]> => {
  const q = query(
    collection(getDb(), RESULTS_COLLECTION),
    where('activityId', '==', activityId),
    orderBy('completedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ActivityResult[];
}; 