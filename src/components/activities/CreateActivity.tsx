import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityType, ActivityTypeActivity } from '../../types/activityTypes';
import { useAuth } from '../../hooks/useAuth';
import { ActivityView } from './ActivityView';
import { useActivityGenerator } from '../../hooks/useActivityGenerator';

interface CreateActivityProps {
  pdfId?: string;
  onActivityCreated?: (activity: ActivityTypeActivity) => void;
}

export const CreateActivity: React.FC<CreateActivityProps> = ({ pdfId, onActivityCreated }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = React.useState('Nueva Actividad');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<ActivityType>(ActivityType.WORD_SEARCH);

  const {
    activity: generatedActivity,
    loading,
    saving,
    error,
    saveMessage,
    generateActivity,
    saveGeneratedActivity,
    resetActivity,
    downloadPrintable
  } = useActivityGenerator();

  const isPdfValid = React.useMemo(() => {
    return pdfId && pdfId !== '' && pdfId !== 'temp';
  }, [pdfId]);

  // Resetear el estado cuando cambia el PDF
  React.useEffect(() => {
    if (!isPdfValid) {
      resetActivity();
    }
  }, [isPdfValid, resetActivity]);

  const handleGenerate = useCallback(async () => {
    if (!isPdfValid || !user?.uid) {
      return;
    }

    try {
      const activity = await generateActivity(
        type,
        pdfId!,
        user.uid,
        title,
        description
      );
      
      if (onActivityCreated) {
        onActivityCreated(activity);
      }
    } catch (error) {
      console.error('Error al generar actividad:', error);
      // El error ya está manejado por el hook
    }
  }, [type, pdfId, user?.uid, title, description, isPdfValid, onActivityCreated, generateActivity]);

  const handleSave = useCallback(async () => {
    if (!generatedActivity) return;
    
    try {
      await saveGeneratedActivity(generatedActivity);
      
      // Navegar después de guardar
      setTimeout(() => {
        navigate(`/dashboard/activities/${generatedActivity.pdfId}`);
      }, 1200);
    } catch (error) {
      console.error('Error al guardar la actividad:', error);
      // El error ya está manejado por el hook
    }
  }, [generatedActivity, saveGeneratedActivity, navigate]);

  if (generatedActivity) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{generatedActivity.title}</h2>
          <button
            onClick={() => resetActivity()}
            className="text-gray-600 hover:text-gray-900"
            title="Cerrar vista previa"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <ActivityView activity={generatedActivity} />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
          <button
            onClick={() => downloadPrintable(generatedActivity)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold ${saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Descargar PDF
          </button>
          
          {generatedActivity.id === 'preview' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-semibold ${saving ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v1H9V4z" />
                  </svg>
                  Guardar Actividad
                </>
              )}
            </button>
          )}
        </div>
        
        {saveMessage && (
          <div className={`text-center p-3 rounded-md font-semibold ${saveMessage.startsWith('¡Actividad') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {saveMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isPdfValid && (
        <div className="text-red-500 font-semibold text-center">
          Debes seleccionar un PDF válido antes de crear una actividad.
        </div>
      )}
      <div>
        <label>Título</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>
      <div>
        <label>Descripción</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>
      <div>
        <label>Tipo de Actividad</label>
        <select
          value={type}
          onChange={e => setType(e.target.value as ActivityType)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value={ActivityType.WORD_SEARCH}>Sopa de Letras</option>
          <option value={ActivityType.CROSSWORD}>Crucigrama</option>
          <option value={ActivityType.WORD_CONNECTION}>Conexión de Palabras</option>
        </select>
      </div>
      {error && <div className="text-red-500 text-center font-semibold">{error}</div>}
      <button
        onClick={handleGenerate}
        disabled={loading || !isPdfValid}
        className={`w-full py-2 px-4 rounded-md text-white ${loading || !isPdfValid ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Generando...' : 'Generar Actividad'}
      </button>
    </div>
  );
}; 