// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import App from './App';
import './index.css'; // Asegúrate que este archivo exista y contenga las directivas de Tailwind

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider 
          defaultTheme="system" 
          enableSystem
          disableTransitionOnChange
          attribute="class"
        >
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
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
