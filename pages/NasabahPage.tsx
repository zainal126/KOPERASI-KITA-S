import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/mockDatabase';
import { Nasabah, Role } from '../types';
import { Plus, Search, User as UserIcon, Wallet, Pencil, X, KeyRound, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  isPersonalProfile?: boolean;
}

const NasabahPage: React.FC<Props> = ({ isPersonalProfile = false }) => {
  const { user } = useAuth();
  const [data, setData] = useState<Nasabah[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  const [formData, setFormData] = useState<Partial<Nasabah>>({
    nama: '', nik: '', alamat: '', no_hp: '', simpanan_pokok: 0, simpanan_wajib: 0, simpanan_sukarela: 0
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        let list = await DatabaseService.getNasabah();
        
        // --- FILTERING LOGIC ---
        if (isPersonalProfile && user?.id_nasabah) {
            // Nasabah melihat diri sendiri
            list = list.filter(n => n.id_nasabah === user.id_nasabah);
        } else if (user?.role === Role.KOORDINATOR) {
            // Koordinator HANYA melihat nasabah yang DIA input (berdasarkan koordinator field)
            list = list.filter(n => n.koordinator === user.username);
        }
        // Admin melihat semua (default)

        setData(list);
        setLoading(false);
    };
    fetchData();
  }, [user, isPersonalProfile, isModalOpen]);

  const filteredData = data.filter(n => 
    n.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.id_nasabah.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (nasabah?: Nasabah) => {
    if (nasabah) {
        setIsEditing(true);
        setEditId(nasabah.id_nasabah);
        setFormData({
            nama: nasabah.nama,
            nik: nasabah.nik,
            alamat: nasabah.alamat,
            no_hp: nasabah.no_hp,
            // Simpanan tidak diedit di sini biasanya, tapi via transaksi. 
            // Namun untuk inisialisasi awal bisa.
            simpanan_pokok: nasabah.simpanan_pokok,
            simpanan_wajib: nasabah.simpanan_wajib,
            simpanan_sukarela: nasabah.simpanan_sukarela
        });
    } else {
        setIsEditing(false);
        setEditId('');
        setFormData({ nama: '', nik: '', alamat: '', no_hp: '', simpanan_pokok: 0, simpanan_wajib: 0, simpanan_sukarela: 0 });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setFormData({ nama: '', nik: '', alamat: '', no_hp: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.nik) return;
    setLoading(true);

    try {
        if (isEditing && editId) {
            // Update Nasabah
            await DatabaseService.updateNasabah(editId, {
                nama: formData.nama,
                nik: formData.nik,
                alamat: formData.alamat,
                no_hp: formData.no_hp
            }, user?.username || 'unknown');
            alert("Data berhasil diperbarui.");
        } else {
            // Create Nasabah & Account
            const newNasabah: Nasabah = {
                id_nasabah: `N${Date.now().toString().slice(-6)}`, // Generate ID
                nama: formData.nama!,
                nik: formData.nik!,
                alamat: formData.alamat || '-',
                no_hp: formData.no_hp || '-',
                simpanan_pokok: Number(formData.simpanan_pokok || 0),
                simpanan_wajib: 0, // Default 0 saat buat baru
                simpanan_sukarela: 0, // Default 0 saat buat baru
                shu: 0,
                saldo: 0, // Virtual, dihiraukan
                koordinator: user?.role === Role.KOORDINATOR ? user.username : 'admin'
            };
            await DatabaseService.addNasabah(newNasabah, user?.username || 'unknown');
            alert(`Nasabah & Akun berhasil dibuat.\n\nUsername: ${newNasabah.id_nasabah}\nPassword: ${newNasabah.nik}`);
        }
        handleCloseModal();
    } catch (e) {
        alert("Gagal menyimpan data");
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);

  const getNetBalance = (nasabah: Nasabah) => {
    // REVISI: Modal Simpanan = Pokok + Wajib + Sukarela (Tanpa SHU)
    const totalSimpanan = (nasabah.simpanan_pokok||0) + (nasabah.simpanan_wajib||0) + (nasabah.simpanan_sukarela||0);
    const hutang = nasabah.total_pinjaman || 0;
    return totalSimpanan - hutang;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isPersonalProfile ? 'Profil Saya' : 'Data Nasabah'}
          </h1>
          <p className="text-slate-500">
             {isPersonalProfile ? 'Informasi keanggotaan dan saldo bersih' : 'Kelola data anggota dan akun login nasabah'}
          </p>
        </div>
        
        {!isPersonalProfile && (user?.role === Role.ADMIN || user?.role === Role.KOORDINATOR) && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Tambah Nasabah</span>
          </button>
        )}
      </div>

      {!isPersonalProfile && (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
            type="text" 
            placeholder="Cari nama atau ID nasabah..." 
            className="w-full bg-white pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      )}

      {loading && <div className="text-center py-4 text-emerald-600">Memuat data...</div>}

      {!loading && isPersonalProfile ? (
        // Personal Profile View
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             {data.length > 0 && (
                <div className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                         <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                             <UserIcon size={48} />
                         </div>
                         <div className="text-center md:text-left flex-1">
                             <h2 className="text-2xl font-bold text-slate-800">{data[0].nama}</h2>
                             <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">Anggota Aktif</span>
                         </div>
                         
                         {/* Card Saldo Bersih */}
                         <div className="md:ml-auto flex flex-col gap-3">
                            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 min-w-[280px]">
                                <p className="text-sm text-emerald-600 mb-1 flex items-center gap-2">
                                    <Wallet size={16} /> Kekayaan Bersih (Modal - Hutang)
                                </p>
                                <p className={`text-2xl font-bold ${getNetBalance(data[0]) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                    {formatIDR(getNetBalance(data[0]))}
                                </p>
                            </div>
                         </div>
                    </div>

                    {/* Breakdown Simpanan */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Simpanan Pokok</p>
                            <p className="font-bold text-slate-800">{formatIDR(data[0].simpanan_pokok)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Simpanan Wajib</p>
                            <p className="font-bold text-slate-800">{formatIDR(data[0].simpanan_wajib)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Simpanan Sukarela</p>
                            <p className="font-bold text-emerald-600">{formatIDR(data[0].simpanan_sukarela)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Total SHU (Belum Ditarik)</p>
                            <p className="font-bold text-amber-600">{formatIDR(data[0].shu)}</p>
                        </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-500">Nomor Induk (ID)</label>
                            <p className="text-slate-800 font-medium">{data[0].id_nasabah}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-500">Total Pinjaman Aktif</label>
                            <p className="text-red-600 font-medium">{formatIDR(data[0].total_pinjaman || 0)}</p>
                        </div>
                    </div>
                </div>
             )}
        </div>
      ) : !loading && (
        // Admin List View
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nama Lengkap</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Pokok + Wajib</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Sukarela</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Pinjaman</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Net (Tanpa SHU)</th>
                    {(user?.role === Role.ADMIN || user?.role === Role.KOORDINATOR) && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Aksi</th>
                    )}
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredData.map((nasabah) => {
                    const wajibPokok = (nasabah.simpanan_pokok || 0) + (nasabah.simpanan_wajib || 0);
                    const netBalance = getNetBalance(nasabah);
                    return (
                        <tr key={nasabah.id_nasabah} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-800">
                            <div className="font-medium">{nasabah.nama}</div>
                            <div className="text-xs text-slate-500 font-mono">{nasabah.id_nasabah}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-right font-mono">
                            {formatIDR(wajibPokok)}
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-600 text-right font-bold">
                            {formatIDR(nasabah.simpanan_sukarela)}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-500 text-right font-mono">
                            {nasabah.total_pinjaman ? formatIDR(nasabah.total_pinjaman) : '-'}
                        </td>
                         <td className={`px-6 py-4 text-sm text-right font-bold ${netBalance < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                            {formatIDR(netBalance)}
                        </td>
                        {(user?.role === Role.ADMIN || user?.role === Role.KOORDINATOR) && (
                            <td className="px-6 py-4 text-sm text-center">
                                <button 
                                    onClick={() => handleOpenModal(nasabah)}
                                    className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="Edit Data"
                                >
                                    <Pencil size={16} />
                                </button>
                            </td>
                        )}
                        </tr>
                    );
                })}
                {filteredData.length === 0 && (
                    <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Data tidak ditemukan (atau bukan nasabah inputan anda)</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-slate-800">
                  {isEditing ? `Edit Nasabah (${editId})` : 'Tambah Nasabah Baru'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {!isEditing && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                    <KeyRound className="text-blue-500 shrink-0 mt-0.5" size={18} />
                    <div className="text-xs text-blue-700">
                        Akun login otomatis dibuat dengan ID Nasabah dan Password = NIK.
                    </div>
                </div>
              )}

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
                <label className="block text-sm font-medium text-slate-700 mb-1">NIK (KTP)</label>
                <input 
                    type="text" required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-slate-900 placeholder:text-slate-400"
                    value={formData.nik}
                    onChange={e => setFormData({...formData, nik: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                <input 
                    type="text" 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.alamat}
                    onChange={e => setFormData({...formData, alamat: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">No HP</label>
                <input 
                    type="text" 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.no_hp}
                    onChange={e => setFormData({...formData, no_hp: e.target.value})}
                />
              </div>

              {!isEditing && (
                  <>
                    <div className="border-t border-slate-100 pt-4 mt-2">
                        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                            <Coins size={16} /> Saldo Awal (Opsional)
                        </h4>
                        <div className="space-y-3">
                             <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Simpanan Pokok</label>
                                <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                                    value={formData.simpanan_pokok}
                                    onChange={e => setFormData({...formData, simpanan_pokok: Number(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>
                  </>
              )}

              <div className="pt-2 flex gap-3">
                <button 
                    type="button" 
                    onClick={handleCloseModal}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg"
                >
                    Batal
                </button>
                <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
                >
                    {loading ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NasabahPage;