import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
  getActivitiesByPdf
} from '../firebase/activityService';
import { 
  ActivityTypeActivity, 
  ActivityType, 
  WordSearchData, 
  CrosswordData, 
  WordConnectionData,
  WordSearchActivity,
  CrosswordActivity,
  WordConnectionActivity,
  BaseActivity
} from '../types/activityTypes';

export const useActivities = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityTypeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      if (!user) return;

      try {
        const loadedActivities = await getActivities(user.uid);
        setActivities(loadedActivities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar las actividades');
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [user]);

  const getActivityById = async (id: string): Promise<ActivityTypeActivity | null> => {
    try {
      return await getActivity(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener la actividad');
      return null;
    }
  };

  const createActivityByType = (
    type: ActivityType,
    baseActivity: Omit<BaseActivity, 'type'>,
    data: WordSearchData | CrosswordData | WordConnectionData
  ): ActivityTypeActivity => {
    switch (type) {
      case ActivityType.WORD_SEARCH:
        return {
          ...baseActivity,
          type: ActivityType.WORD_SEARCH,
          data: data as WordSearchData
        } satisfies WordSearchActivity;
        
      case ActivityType.CROSSWORD:
        return {
          ...baseActivity,
          type: ActivityType.CROSSWORD,
          data: data as CrosswordData
        } satisfies CrosswordActivity;
        
      case ActivityType.WORD_CONNECTION:
        return {
          ...baseActivity,
          type: ActivityType.WORD_CONNECTION,
          data: data as WordConnectionData
        } satisfies WordConnectionActivity;
        
      default:
        throw new Error('Tipo de actividad no soportado');
    }
  };

  const addActivity = async (
    type: ActivityType,
    title: string,
    description: string,
    data: WordSearchData | CrosswordData | WordConnectionData,
    userId: string,
    pdfId?: string
  ): Promise<string> => {
    try {
      const id = await createActivity({
        type,
        title,
        description,
        pdfId: pdfId || '',
        userId,
        data
      });
      
      const baseActivity = {
        id,
        title,
        description,
        pdfId: pdfId || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId
      };

      const newActivity = createActivityByType(type, baseActivity, data);
      setActivities(prev => [...prev, newActivity] as ActivityTypeActivity[]);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la actividad');
      throw err;
    }
  };

  const updateActivityById = async (
    id: string,
    updates: Partial<ActivityTypeActivity>
  ): Promise<void> => {
    try {
      await updateActivity(id, updates);
      setActivities(prev =>
        prev.map(activity =>
          activity.id === id ? { ...activity, ...updates } : activity
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la actividad');
      throw err;
    }
  };

  const deleteActivityById = async (id: string): Promise<void> => {
    try {
      await deleteActivity(id);
      setActivities(prev => prev.filter(activity => activity.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la actividad');
      throw err;
    }
  };

  const getActivitiesByPdfId = async (pdfId: string): Promise<ActivityTypeActivity[]> => {
    try {
      return await getActivitiesByPdf(pdfId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener las actividades del PDF');
      throw err;
    }
  };

  return {
    activities,
    loading,
    error,
    getActivityById,
    addActivity,
    updateActivityById,
    deleteActivityById,
    getActivitiesByPdfId
  };
}; 