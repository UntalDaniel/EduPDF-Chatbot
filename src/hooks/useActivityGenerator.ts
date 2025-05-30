import { useState, useCallback } from 'react';
import { ActivityType, ActivityTypeActivity } from '../types/activityTypes';
import { createNewActivity, saveActivity, generatePrintableActivity } from '../services/activityService';
import { saveAs } from 'file-saver';

interface UseActivityGeneratorReturn {
  activity: ActivityTypeActivity | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveMessage: string | null;
  generateActivity: (
    type: ActivityType,
    pdfId: string,
    userId: string,
    title?: string,
    description?: string
  ) => Promise<ActivityTypeActivity>;
  saveGeneratedActivity: (activity: ActivityTypeActivity) => Promise<string | null>;
  resetActivity: () => void;
  downloadPrintable: (activity: ActivityTypeActivity) => Promise<void>;
}

export const useActivityGenerator = (): UseActivityGeneratorReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityTypeActivity | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const generateActivity = useCallback(async (
    type: ActivityType,
    pdfId: string,
    userId: string,
    title: string = 'Nueva Actividad',
    description: string = ''
  ) => {
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    
    try {
      const newActivity = await createNewActivity(type, pdfId, userId, title, description);
      setActivity(newActivity);
      return newActivity;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al generar la actividad';
      setError(errorMessage);
      console.error('Error en generateActivity:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveGeneratedActivity = useCallback(async (activity: ActivityTypeActivity) => {
    if (!activity) return null;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      // 1. Primero guardamos la actividad en Firestore para obtener un ID
      const { id: _, ...activityToSave } = activity;
      const activityId = await saveActivity(activityToSave);
      
      // 2. Generamos la versión imprimible con el ID real
      const updatedActivity = { ...activity, id: activityId };
      const printableBlob = await generatePrintableActivity(updatedActivity);
      
      // 3. Aquí podrías subir el PDF a Firebase Storage si es necesario
      // Por ahora, lo dejamos como un blob que se puede descargar
      
      // 4. Opcional: Descargar automáticamente el PDF
      saveAs(printableBlob, `actividad-${activityId}.pdf`);
      
      setSaveMessage('¡Actividad guardada exitosamente! Se ha generado el PDF.');
      return activityId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar la actividad';
      setError(errorMessage);
      console.error('Error en saveGeneratedActivity:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);
  
  // Función para descargar el PDF sin guardar la actividad
  const downloadPrintable = useCallback<UseActivityGeneratorReturn['downloadPrintable']>(async (activity) => {
    try {
      setSaving(true);
      const blob = await generatePrintableActivity(activity);
      saveAs(blob, `actividad-${activity.id || 'nueva'}.pdf`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al generar el PDF';
      setError(errorMessage);
      console.error('Error en downloadPrintable:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const resetActivity = useCallback(() => {
    setActivity(null);
    setError(null);
    setSaveMessage(null);
  }, []);

  return {
    activity,
    loading,
    saving,
    error,
    saveMessage,
    generateActivity,
    saveGeneratedActivity,
    resetActivity,
    downloadPrintable, // Asegurarse de exportar la función
  };
};
