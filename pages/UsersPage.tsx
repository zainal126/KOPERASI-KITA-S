import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/mockDatabase';
import { Role } from '../types';
import { Plus, Search, Trash2, Pencil, X, Shield, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  
  const [formData, setFormData] = useState({
    nama: '',
    username: '',
    password: '',
    role: Role.KOORDINATOR as string
  });

  const fetchData = async () => {
    setLoading(true);
    try {
        const list = await DatabaseService.getUsers();
        // Filter out Nasabah entries from Users sheet if any exist (though we cleaned logic)
        // and only show Admins/Coordinators
        const staff = list.filter((u: any) => u.role === Role.ADMIN || u.role === Role.KOORDINATOR);
        setUsers(staff);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (userData?: any) => {
    if (userData) {
        setIsEditing(true);
        setEditId(userData.id);
        setFormData({
            nama: userData.nama,
            username: userData.username,
            password: userData.password || userData.Pass || '', // Handle varied column names
            role: userData.role
        });
    } else {
        setIsEditing(false);
        setEditId('');
        setFormData({ nama: '', username: '', password: '', role: Role.KOORDINATOR });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        const payload = {
            nama: formData.nama,
            username: formData.username,
            password: formData.password,
            role: formData.role
        };

        if (isEditing && editId) {
            await DatabaseService.updateUser(editId, payload, user?.username || 'admin');
            alert("Data User berhasil diperbarui");
        } else {
            const newUser = {
                ...payload,
                id: Date.now().toString()
            };
            await DatabaseService.createUser(newUser, user?.username || 'admin');
            alert("User berhasil ditambahkan");
        }
        setIsModalOpen(false);
        await fetchData();
    } catch (e: any) {
        alert("Gagal: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
      if (username === 'admin' || username === user?.username) {
          alert("Tidak dapat menghapus akun sendiri atau super admin.");
          return;
      }
      if (confirm(`Hapus user ${username}?`)) {
          setLoading(true);
          await DatabaseService.deleteUser(id, user?.username || 'admin');
          await fetchData();
          setLoading(false);
      }
  };

  const filteredUsers = users.filter(u => 
    u.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Staf</h1>
          <p className="text-slate-500">Kelola akun Admin dan Koordinator</p>
        </div>
        
        <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
            <Plus size={20} />
            <span>Tambah User</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari nama atau username..." 
          className="w-full bg-white pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder:text-slate-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <div className="p-8 text-center text-slate-500">Memuat data...</div>}
        
        {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nama Lengkap</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Username</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{u.nama}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{u.username}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`flex items-center gap-1 w-fit px-2 py-1 rounded text-xs font-bold uppercase ${
                        u.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                        {u.role === Role.ADMIN ? <ShieldCheck size={14}/> : <Shield size={14}/>}
                        {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center flex justify-center gap-2">
                    <button 
                        onClick={() => handleOpenModal(u)}
                        className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-lg"
                        title="Edit User"
                    >
                        <Pencil size={16} />
                    </button>
                    {u.username !== 'admin' && u.username !== user?.username && (
                        <button 
                            onClick={() => handleDelete(u.id, u.username)}
                            className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg"
                            title="Hapus User"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">
                  {isEditing ? 'Edit User' : 'Tambah User Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                    type="text" required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.nama}
                    onChange={e => setFormData({...formData, nama: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                    type="text" required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    disabled={isEditing && formData.username === 'admin'} // Protect root admin
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                    type="text" required={!isEditing}
                    placeholder={isEditing ? "Kosongkan jika tidak diganti" : "Password login"}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                >
                    <option value={Role.KOORDINATOR}>Koordinator</option>
                    <option value={Role.ADMIN}>Admin</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg"
                >
                    Batal
                </button>
                <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
                >
                    {loading ? 'Menyimpan...' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;