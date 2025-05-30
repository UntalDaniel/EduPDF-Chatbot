import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { PdfType } from '../types/pdfTypes';

const PDFS_COLLECTION = 'pdfs';

export const getPdfs = async (): Promise<PdfType[]> => {
    try {
        const q = query(
            collection(db, PDFS_COLLECTION),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })) as PdfType[];
    } catch (error) {
        console.error('Error al obtener PDFs:', error);
        throw error;
    }
};

export const getPdfsByUser = async (userId: string): Promise<PdfType[]> => {
    try {
        const q = query(
            collection(db, PDFS_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        })) as PdfType[];
    } catch (error) {
        console.error('Error al obtener PDFs del usuario:', error);
        throw error;
    }
};

export const uploadPdf = async (
    file: File,
    title: string,
    description: string,
    userId: string
): Promise<PdfType> => {
    try {
        // Subir archivo a Storage
        const storageRef = ref(storage, `pdfs/${userId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // Crear documento en Firestore
        const pdfData = {
            title,
            description,
            url,
            size: file.size,
            pages: 0, // TODO: Implementar conteo de páginas
            createdAt: new Date(),
            updatedAt: new Date(),
            userId
        };

        const docRef = await addDoc(collection(db, PDFS_COLLECTION), pdfData);
        return {
            id: docRef.id,
            ...pdfData
        };
    } catch (error) {
        console.error('Error al subir PDF:', error);
        throw error;
    }
};

export const updatePdf = async (
    pdfId: string,
    updates: Partial<PdfType>
): Promise<void> => {
    try {
        const pdfRef = doc(db, PDFS_COLLECTION, pdfId);
        await updateDoc(pdfRef, {
            ...updates,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error al actualizar PDF:', error);
        throw error;
    }
};

export const deletePdf = async (pdfId: string, url: string): Promise<void> => {
    try {
        // Eliminar archivo de Storage
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);

        // Eliminar documento de Firestore
        const pdfRef = doc(db, PDFS_COLLECTION, pdfId);
        await deleteDoc(pdfRef);
    } catch (error) {
        console.error('Error al eliminar PDF:', error);
        throw error;
    }
};

export const getPdfById = async (pdfId: string): Promise<PdfType> => {
    try {
        const pdfRef = doc(db, PDFS_COLLECTION, pdfId);
        const pdfDoc = await getDoc(pdfRef);

        if (!pdfDoc.exists()) {
            throw new Error('PDF no encontrado');
        }

        return {
            id: pdfDoc.id,
            ...pdfDoc.data(),
            createdAt: pdfDoc.data().createdAt?.toDate(),
            updatedAt: pdfDoc.data().updatedAt?.toDate()
        } as PdfType;
    } catch (error) {
        console.error('Error al obtener PDF:', error);
        throw error;
    }
}; 