import React from 'react';
import { ActivityTypeActivity } from '../../types/activityTypes';
import { ActivityView } from './ActivityView';

interface ActivityListProps {
  activities: ActivityTypeActivity[];
  onActivitySelect?: (activity: ActivityTypeActivity) => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities, onActivitySelect }) => {
  if (activities.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No hay actividades disponibles
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">{activity.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{activity.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Creado: {new Date(activity.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => onActivitySelect?.(activity)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Ver Detalles
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 