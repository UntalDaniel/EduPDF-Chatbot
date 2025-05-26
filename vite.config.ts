// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // <--- ¡Asegúrate que sea '-swc' aquí!

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
});
