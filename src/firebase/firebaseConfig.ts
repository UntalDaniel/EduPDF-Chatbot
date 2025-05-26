// src/firebase/firebaseConfig.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app'; // Type-only import
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth'; // Type-only import
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore'; // Type-only import
import { getStorage } from 'firebase/storage'; // Importar Firebase Storage
import type { FirebaseStorage } from 'firebase/storage'; // Type-only import

// Las variables globales __firebase_config y __app_id son declaradas en vite-env.d.ts
// Se espera que sean inyectadas en tiempo de ejecución por el entorno Canvas.

const firebaseConfigFromCanvasString = typeof __firebase_config !== 'undefined' ? __firebase_config : undefined;
let firebaseConfigFromCanvasParsed = null;

if (firebaseConfigFromCanvasString) {
  try {
    firebaseConfigFromCanvasParsed = JSON.parse(firebaseConfigFromCanvasString);
    if (!firebaseConfigFromCanvasParsed.apiKey || !firebaseConfigFromCanvasParsed.projectId) {
        console.warn("Configuración de Firebase desde Canvas está incompleta (falta apiKey o projectId).");
        firebaseConfigFromCanvasParsed = null; // Invalidar si está incompleta
    }
  } catch (e) {
    console.error("Error al parsear __firebase_config:", e, "Valor recibido:", firebaseConfigFromCanvasString);
    firebaseConfigFromCanvasParsed = null;
  }
}

// Configuración local por defecto (SOLO COMO FALLBACK si no estás en Canvas o la config de Canvas falla)
// IMPORTANTE: NO DEBES MODIFICAR ESTOS VALORES SI ESTÁS EN EL ENTORNO DE CANVAS.
// Canvas inyectará los valores correctos a través de __firebase_config.
const localDefaultFirebaseConfig = {
  apiKey: "AIzaSyAV5iARIOZxE71ZBBnDl2W8QCyXyx7okd4",
  authDomain: "chatbot-pdf-7076d.firebaseapp.com",
  projectId: "chatbot-pdf-7076d",
  storageBucket: "chatbot-pdf-7076d.firebasestorage.app", // Asegúrate que este valor sea correcto para Storage
  messagingSenderId: "Y774393958202",
  appId: "1:774393958202:web:ca881cfc308623ff49ca03"
};

const finalFirebaseConfig = firebaseConfigFromCanvasParsed || localDefaultFirebaseConfig;

export const canvasAppId = (typeof __app_id !== 'undefined' && __app_id)
  ? __app_id
  : finalFirebaseConfig.appId || 'default-app-id-fallback';

let firebaseAppInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null; // Instancia para Storage

if (finalFirebaseConfig && finalFirebaseConfig.apiKey && finalFirebaseConfig.apiKey !== "YOUR_LOCAL_API_KEY_FALLBACK" && finalFirebaseConfig.projectId) {
  if (!getApps().length) {
    try {
      firebaseAppInstance = initializeApp(finalFirebaseConfig);
      console.log("Firebase initialized with config for projectId:", finalFirebaseConfig.projectId);
    } catch (e) {
      console.error("Error initializing Firebase app:", e);
    }
  } else {
    firebaseAppInstance = getApp();
    if (firebaseAppInstance) {
       console.log("Firebase app already initialized using projectId:", firebaseAppInstance.options.projectId);
    }
  }

  if (firebaseAppInstance) {
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    storageInstance = getStorage(firebaseAppInstance); // Inicializar Storage
  }
} else {
  console.error("Firebase configuration is missing, invalid, or using placeholder values. Firebase could not be initialized. Ensure Canvas provides config or update placeholders if local.");
}

if (!authInstance) {
    console.error("Firebase Auth could not be initialized. Check Firebase config and initialization logic.");
}
if (!dbInstance) {
    console.error("Firebase Firestore could not be initialized. Check Firebase config and initialization logic.");
}
if (!storageInstance) { // Verificar Storage
    console.error("Firebase Storage could not be initialized. Check Firebase config (especially storageBucket) and initialization logic.");
}

export { 
    firebaseAppInstance as app, 
    authInstance as auth, 
    dbInstance as db,
    storageInstance as storage // Exportar Storage
};
