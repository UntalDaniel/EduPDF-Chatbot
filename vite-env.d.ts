/// <reference types="vite/client" />

declare global {
  // Estas variables son esperadas globalmente en tiempo de ejecución.
  // TypeScript necesita conocerlas para evitar errores de "Cannot find name".
  // Si no son inyectadas por tu entorno (ej. Canvas), serán 'undefined'.

  const __firebase_config: string | undefined;
  const __app_id: string | undefined;
  const __initial_auth_token: string | undefined;

  // Espacio de nombres JSX para que TypeScript reconozca elementos JSX
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Agrega aquí otras variables de entorno que uses con VITE_ prefijo
  // Ejemplo: readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Exportar algo vacío para asegurar que es tratado como un módulo
export {};
