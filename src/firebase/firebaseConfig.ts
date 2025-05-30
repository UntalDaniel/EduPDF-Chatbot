// src/firebase/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app'; // Type-only import
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth'; // Type-only import
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore'; // Type-only import
import { getStorage } from 'firebase/storage'; // Importar Firebase Storage
import type { FirebaseStorage } from 'firebase/storage'; // Type-only import

// Las variables globales __firebase_config y __app_id son declaradas en vite-env.d.ts
// Se espera que sean inyectadas en tiempo de ejecución por el entorno Canvas.

// Configuración de Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ID de la aplicación Canvas (opcional)
export const canvasAppId = import.meta.env.VITE_CANVAS_APP_ID || null;

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
