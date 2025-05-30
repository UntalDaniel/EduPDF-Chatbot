import React, { useEffect, useState } from 'react';
import { getGroupsByTeacher } from '../firebase/firestoreService';
import { auth } from '../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, PlusCircle, ArrowLeft } from 'lucide-react';
import DashboardNavbar from '../components/DashboardNavbar';

const GroupsDashboard: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getGroupsByTeacher(user.uid)
      .then(setGroups)
      .catch(() => setError('Error al cargar los grupos.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleCreateGroup = async () => {
    // Aquí deberías llamar a tu función para crear grupo y luego recargar la lista
    alert('Funcionalidad de crear grupo aún no implementada.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error</h1>
        <p className="text-lg mb-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sky-400 hover:text-sky-200 font-semibold text-lg transition-colors group">
          <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" /> Volver
        </button>
        <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-2 mb-8"><Users size={32}/> Grupos</h1>
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
              <div className="text-lg md:text-xl font-bold text-sky-200 mb-1">{group.name}</div>
              <button className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2 rounded-xl flex items-center gap-2 text-base shadow-md transition-all duration-200" onClick={() => navigate(`/dashboard/groups/${group.id}`)}>
                Ver grupo
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupsDashboard; 