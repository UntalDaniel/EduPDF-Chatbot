import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useActivities } from '../hooks/useActivities';
import { ActivityTypeActivity } from '../types/activityTypes';
import { ActivityView } from '../components/activities/ActivityView';

export const SolveActivityScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getActivityById } = useActivities();
  const [activity, setActivity] = useState<ActivityTypeActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivity = async () => {
      if (!id) {
        setError('ID de actividad no proporcionado');
        setLoading(false);
        return;
      }

      try {
        const loadedActivity = await getActivityById(id);
        if (!loadedActivity) {
          setError('Actividad no encontrada');
        } else {
          setActivity(loadedActivity);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la actividad');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [id, getActivityById]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">{error || 'Actividad no encontrada'}</div>
        <button
          onClick={() => navigate(-1)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:text-blue-600 transition-colors"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">{activity.title}</h1>
        <p className="text-gray-600 mb-6">{activity.description}</p>

        <ActivityView
          activity={activity}
          onClose={() => navigate(-1)}
        />
      </div>
    </div>
  );
}; 