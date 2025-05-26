/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Asegúrate de que Tailwind escanee tu HTML principal
    "./src/**/*.{js,ts,jsx,tsx}", // Esto escanea todos los archivos relevantes en la carpeta src
  ],
  theme: {
    extend: {
      // Aquí puedes extender el tema de Tailwind si lo necesitas más adelante
      // Ejemplo:
      // fontFamily: {
      //   sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      // },
      animation: {
        modalEnter: 'modalEnter 0.2s ease-out forwards',
      },
      keyframes: {
        modalEnter: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      }
    },
  },
  plugins: [
    // Aquí puedes añadir plugins de Tailwind si los necesitas
  ],
}
