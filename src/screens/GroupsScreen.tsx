import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { getGroupsByTeacher, createGroup, TeacherGroup } from '../firebase/firestoreService';
import { Users, Plus, Edit2, Trash2, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  teacherId: string;
}

const GroupsScreen: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    loadGroups();
  }, [user]);

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const groupsRef = collection(db, `usuarios/${user.uid}/groups`);
      const groupsSnap = await getDocs(groupsRef);
      const groupsData = groupsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Group[];
      setGroups(groupsData);
    } catch (err: any) {
      setError('Error al cargar los grupos: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const groupsRef = collection(db, `usuarios/${user.uid}/groups`);
      const newGroup = {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        createdAt: new Date(),
        teacherId: user.uid
      };
      await addDoc(groupsRef, newGroup);
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateModal(false);
      await loadGroups();
    } catch (err: any) {
      setError('Error al crear el grupo: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async () => {
    if (!user || !selectedGroup || !newGroupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const groupRef = doc(db, `usuarios/${user.uid}/groups/${selectedGroup.id}`);
      await updateDoc(groupRef, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim()
      });
      setNewGroupName('');
      setNewGroupDescription('');
      setShowEditModal(false);
      setSelectedGroup(null);
      await loadGroups();
    } catch (err: any) {
      setError('Error al editar el grupo: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!user || !window.confirm('¿Estás seguro de que quieres eliminar este grupo?')) return;
    setLoading(true);
    setError(null);
    try {
      const groupRef = doc(db, `usuarios/${user.uid}/groups/${groupId}`);
      await deleteDoc(groupRef);
      await loadGroups();
    } catch (err: any) {
      setError('Error al eliminar el grupo: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !groups.length) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-semibold text-red-400 mb-2">{error}</h2>
            <button
              onClick={loadGroups}
              className="text-sky-400 hover:text-sky-300"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <Users className="w-6 h-6" /> Mis Grupos
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" /> Crear Grupo
          </button>
        </div>

        {groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 backdrop-blur-md hover:scale-[1.01] hover:shadow-2xl transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-sky-200">{group.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedGroup(group);
                        setNewGroupName(group.name);
                        setNewGroupDescription(group.description || '');
                        setShowEditModal(true);
                      }}
                      className="p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-900/30 rounded-lg transition-colors"
                      title="Editar grupo"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Eliminar grupo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {group.description && (
                  <p className="text-sm text-slate-400 mb-4">{group.description}</p>
                )}
                <button
                  onClick={() => navigate(`/dashboard/groups/${group.id}`)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-5 h-5" /> Ver Detalles
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl">
            <Users className="mx-auto h-16 w-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              No tienes grupos creados
            </h3>
            <p className="text-slate-500">
              Crea un nuevo grupo para comenzar a organizar tus exámenes.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Crear Grupo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Crear Nuevo Grupo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ingresa el nombre del grupo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ingresa una descripción para el grupo"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewGroupName('');
                    setNewGroupDescription('');
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Crear Grupo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Grupo */}
      {showEditModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Editar Grupo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ingresa el nombre del grupo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ingresa una descripción para el grupo"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedGroup(null);
                    setNewGroupName('');
                    setNewGroupDescription('');
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditGroup}
                  disabled={!newGroupName.trim()}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsScreen; 