import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePDFs } from '../hooks/usePDFs';
import { useActivities } from '../hooks/useActivities';
import { PDF } from '../types/pdfTypes';
import { ActivityType } from '../types/activityTypes';
import type { ActivityTypeActivity } from '../types/activityTypes';

export const Dashboard: React.FC = () => {
  const { pdfs, loading: pdfsLoading, error: pdfsError } = usePDFs();
  const { activities, loading: activitiesLoading, error: activitiesError } = useActivities();

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case ActivityType.WORD_SEARCH:
        return 'Sopa de Letras';
      case ActivityType.CROSSWORD:
        return 'Crucigrama';
      case ActivityType.WORD_CONNECTION:
        return 'Conectar Palabras';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-sky-300 mb-8">Dashboard</h1>

        {/* Sección de PDFs */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-sky-300">Mis PDFs</h2>
            <Link
              to="/dashboard/pdfs/upload"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
            >
              Subir PDF
            </Link>
          </div>

          {pdfsLoading && (
            <div className="text-center py-10">
              <p className="text-slate-400">Cargando PDFs...</p>
            </div>
          )}

          {pdfsError && (
            <div className="text-center py-10">
              <p className="text-red-400">{pdfsError}</p>
            </div>
          )}

          {!pdfsLoading && !pdfsError && pdfs.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-400">No hay PDFs subidos</p>
            </div>
          )}

          {!pdfsLoading && !pdfsError && pdfs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md rounded-xl p-6 shadow-xl"
                >
                  <h3 className="text-xl font-semibold text-white mb-2">{pdf.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Subido el {new Date(pdf.uploadedAt).toLocaleDateString()}
                  </p>
                  <div className="flex justify-end gap-3">
                    <Link
                      to={`/dashboard/pdfs/${pdf.id}`}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                    >
                      Ver Detalles
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección de Actividades */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-sky-300">Mis Actividades</h2>
          </div>

          {activitiesLoading && (
            <div className="text-center py-10">
              <p className="text-slate-400">Cargando actividades...</p>
            </div>
          )}

          {activitiesError && (
            <div className="text-center py-10">
              <p className="text-red-400">{activitiesError}</p>
            </div>
          )}

          {!activitiesLoading && !activitiesError && activities.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-400">No hay actividades creadas</p>
            </div>
          )}

          {!activitiesLoading && !activitiesError && activities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity: ActivityTypeActivity) => (
                <div
                  key={activity.id}
                  className="bg-slate-700 bg-opacity-50 backdrop-filter backdrop-blur-md rounded-xl p-6 shadow-xl"
                >
                  <span className="inline-block px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-sm mb-2">
                    {getActivityTypeLabel(activity.type)}
                  </span>
                  <h3 className="text-xl font-semibold text-white mb-1">{activity.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Creada el {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-slate-300 mb-6 line-clamp-2">{activity.description}</p>
                  <div className="flex justify-end gap-3">
                    <Link
                      to={`/dashboard/activities/${activity.id}`}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                    >
                      Ver Detalles
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}; 