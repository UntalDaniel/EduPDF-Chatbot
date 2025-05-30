import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { PDF } from '../types/pdfTypes';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const usePDFs = () => {
  const { user } = useAuth();
  const [pdfs, setPDFs] = useState<PDF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError('Firebase no está inicializado correctamente');
      setLoading(false);
      return;
    }

    if (user) {
      loadPDFs();
    }
  }, [user]);

  const loadPDFs = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const pdfsRef = collection(db, 'pdfs');
      const q = query(
        pdfsRef,
        where('userId', '==', user.uid),
        orderBy('uploadedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const loadedPDFs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt.toDate(),
      })) as PDF[];

      setPDFs(loadedPDFs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los PDFs');
    } finally {
      setLoading(false);
    }
  };

  const getPDF = async (pdfId: string): Promise<PDF | null> => {
    try {
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const pdfRef = doc(db, 'pdfs', pdfId);
      const pdfDoc = await getDoc(pdfRef);

      if (!pdfDoc.exists()) {
        return null;
      }

      const data = pdfDoc.data();
      return {
        id: pdfDoc.id,
        ...data,
        uploadedAt: data.uploadedAt.toDate(),
      } as PDF;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener el PDF');
      throw err;
    }
  };

  const addPDF = async (pdf: Omit<PDF, 'id' | 'uploadedAt'>): Promise<string> => {
    try {
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const pdfsRef = collection(db, 'pdfs');
      const newPDF = {
        ...pdf,
        userId: user.uid,
        uploadedAt: serverTimestamp(),
      };

      const docRef = await addDoc(pdfsRef, newPDF);
      await loadPDFs();

      return docRef.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar el PDF');
      throw err;
    }
  };

  const updatePDF = async (pdfId: string, updates: Partial<PDF>): Promise<void> => {
    try {
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const pdfRef = doc(db, 'pdfs', pdfId);
      await updateDoc(pdfRef, updates);
      await loadPDFs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el PDF');
      throw err;
    }
  };

  const deletePDF = async (pdfId: string): Promise<void> => {
    try {
      setError(null);

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const pdfRef = doc(db, 'pdfs', pdfId);
      await deleteDoc(pdfRef);
      await loadPDFs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el PDF');
      throw err;
    }
  };

  return {
    pdfs,
    loading,
    error,
    getPDF,
    addPDF,
    updatePDF,
    deletePDF,
    refreshPDFs: loadPDFs,
  };
}; 