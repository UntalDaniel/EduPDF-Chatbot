import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const NotFoundScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
      <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
      <h1 className="text-4xl font-bold mb-4">404 - Página no encontrada</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
        Lo sentimos, la página que estás buscando no existe o ha sido movida.
      </p>
      <div className="space-x-4">
        <Button
          variant="default"
          onClick={() => navigate(-1)}
          className="bg-sky-500 hover:bg-sky-600"
        >
          Volver atrás
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="border-sky-500 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950"
        >
          Ir al inicio
        </Button>
      </div>
    </div>
  );
};

export default NotFoundScreen; 