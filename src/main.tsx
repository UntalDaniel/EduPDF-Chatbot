// src/main.tsx
import { StrictMode } from 'react'; // React se elimina si no se usa explícitamente
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Asegúrate que este archivo exista y contenga las directivas de Tailwind

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error("CRITICAL: Root element '#root' not found in HTML. App cannot be mounted.");
  const fallbackDiv = document.createElement('div');
  fallbackDiv.innerHTML = `
    <div style="color: white; background-color: #111827; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; padding: 20px; text-align: center;">
      <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Error Crítico de Inicio</h1>
      <p style="margin-bottom: 0.5rem;">No se encontró el elemento HTML con id="root".</p>
      <p>La aplicación React no puede iniciarse.</p>
    </div>
  `;
  document.body.appendChild(fallbackDiv);
}
