import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/mockDatabase';
import { Pinjaman, Role, Nasabah } from '../types';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Plus, X, Calculator, Percent } from 'lucide-react';

const PinjamanPage = () => {
  const { user } = useAuth();
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([]);
  const [nasabahList, setNasabahList] = useState<Nasabah[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id_nasabah: '',
    jumlah_pinjaman: '',
    bunga_persen: '0', // Bunga per Bulan
    tenor_bulan: '12',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
        let list = await DatabaseService.getPinjaman();
        if (user?.role === Role.NASABAH) {
           list = list.filter(p => p.id_nasabah === user.id_nasabah);
        }
        setPinjaman(list);
        
        if (user?.role !== Role.NASABAH) {
            let ns = await DatabaseService.getNasabah();
            
            // Filter list nasabah agar Koordinator hanya bisa membuat pinjaman untuk nasabah inputannya
            if (user?.role === Role.KOORDINATOR) {
                ns = ns.filter(n => n.koordinator === user.username);
            }

            setNasabahList(ns);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_nasabah || !formData.jumlah_pinjaman) return;

    setLoading(true);
    try {
        const jumlah = Number(formData.jumlah_pinjaman);
        const bungaPersen = Number(formData.bunga_persen);
        const tenor = Number(formData.tenor_bulan);
        
        // Perhitungan Bunga Flat: (Pokok * %Bunga/Bln * Tenor)
        const totalBunga = jumlah * (bungaPersen / 100) * tenor;
        const totalHutang = jumlah + totalBunga;
        const angsuran = Math.ceil(totalHutang / tenor);

        const newLoan: Omit<Pinjaman, 'status'> = {
            id_pinjaman: `P${Date.now().toString().slice(-6)}`,
            id_nasabah: formData.id_nasabah,
            jumlah_pinjaman: jumlah, // Pokok
            bunga_persen: bungaPersen,
            tenor_bulan: tenor,
            angsuran_bulanan: angsuran,
            sisa_pinjaman: totalHutang // Start with Total Debt (Pokok + Bunga)
        };

        await DatabaseService.createPinjaman(newLoan, user?.username || 'admin');
        
        alert("Pinjaman berhasil dibuat!");
        setIsModalOpen(false);
        setFormData({ id_nasabah: '', jumlah_pinjaman: '', bunga_persen: '0', tenor_bulan: '12' });
        await fetchData();

    } catch (e: any) {
        alert("Gagal membuat pinjaman: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);

  // Helper untuk hitung estimasi di form
  const estimasi = React.useMemo(() => {
    const pokok = Number(formData.jumlah_pinjaman) || 0;
    const bunga = Number(formData.bunga_persen) || 0; // Per bulan
    const tenor = Number(formData.tenor_bulan) || 12;
    
    // Bunga = Pokok * (%/bln) * tenor
    const totalBunga = pokok * (bunga / 100) * tenor;
    const totalHutang = pokok + totalBunga;
    const angsuran = Math.ceil(totalHutang / tenor);
    
    return { totalBunga, totalHutang, angsuran };
  }, [formData.jumlah_pinjaman, formData.bunga_persen, formData.tenor_bulan]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Pinjaman</h1>
          <p className="text-slate-500">Status pinjaman dan angsuran anggota</p>
        </div>
        
        {(user?.role === Role.ADMIN || user?.role === Role.KOORDINATOR) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Buat Pinjaman Baru</span>
          </button>
        )}
      </div>

      {loading && <div className="p-8 text-center text-slate-500">Memuat data...</div>}

      {!loading && (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {pinjaman.map((p) => {
          // 1. Hitung Total Tagihan (Pokok + Semua Bunga)
          // Rumus: Pokok + (Pokok * Bunga% * Tenor)
          const totalBunga = p.jumlah_pinjaman * (p.bunga_persen || 0) / 100 * p.tenor_bulan;
          const totalHutang = p.jumlah_pinjaman + totalBunga;
          
          // 2. Hitung yang sudah dibayar
          // Jika sisa_pinjaman < 0 (kelebihan bayar), anggap sisa 0 untuk visualisasi terbayar
          const sisaReal = Math.max(0, p.sisa_pinjaman);
          const terbayar = totalHutang - sisaReal;
          
          // 3. Hitung Progress % (Clamp antara 0 - 100)
          let progress = totalHutang > 0 ? (terbayar / totalHutang) * 100 : 0;
          progress = Math.min(Math.max(progress, 0), 100);

          // Status berdasarkan sisa pinjaman aktual
          const status = p.sisa_pinjaman <= 0 ? 'lunas' : 'aktif';
          
          return (
            <div key={p.id_pinjaman} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-1 h-full ${status === 'lunas' ? 'bg-green-500' : 'bg-blue-500'}`} />
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{p.id_nasabah}</h3>
                    <p className="text-xs text-slate-400">ID: {p.id_pinjaman}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    status === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {status}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Pokok Pinjaman</span>
                    <span className="font-semibold text-slate-800">{formatIDR(p.jumlah_pinjaman)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Bunga ({p.bunga_persen}%/bln)</span>
                    <span className="font-semibold text-slate-800">
                        {formatIDR(totalBunga)}
                    </span>
                  </div>
                   <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Angsuran/Bulan</span>
                    <span className="font-semibold text-slate-800">{formatIDR(p.angsuran_bulanan)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tenor</span>
                    <span className="font-semibold text-slate-800">{p.tenor_bulan} Bulan</span>
                  </div>
                </div>

                <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Terbayar: <span className="font-semibold text-slate-700">{formatIDR(terbayar)}</span></span>
                        <span className="font-bold text-slate-700">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ${status === 'lunas' ? 'bg-green-500' : 'bg-blue-600'}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="text-right mt-1">
                         <span className="text-[10px] text-slate-400">Total Tagihan: {formatIDR(totalHutang)}</span>
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">Sisa Tagihan</span>
                    <span className="text-lg font-bold text-red-600">{formatIDR(p.sisa_pinjaman)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {!loading && pinjaman.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <AlertCircle className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-500">Belum ada data pinjaman aktif.</p>
          </div>
      )}

      {/* MODAL BUAT PINJAMAN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Buat Pinjaman Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Nasabah</label>
                <select 
                    required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                    value={formData.id_nasabah}
                    onChange={e => setFormData({...formData, id_nasabah: e.target.value})}
                >
                    <option value="">-- Pilih Nasabah --</option>
                    {nasabahList.map(n => (
                        <option key={n.id_nasabah} value={n.id_nasabah}>
                            {n.id_nasabah} - {n.nama}
                        </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Pokok (Rp)</label>
                <input 
                    type="number" required min="10000"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.jumlah_pinjaman}
                    onChange={e => setFormData({...formData, jumlah_pinjaman: e.target.value})}
                    placeholder="Contoh: 1000000"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bunga / Bulan (%)</label>
                    <div className="relative">
                        <input 
                            type="number" required min="0" step="0.1"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 pr-8 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                            value={formData.bunga_persen}
                            onChange={e => setFormData({...formData, bunga_persen: e.target.value})}
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenor (Bulan)</label>
                    <select 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                        value={formData.tenor_bulan}
                        onChange={e => setFormData({...formData, tenor_bulan: e.target.value})}
                    >
                        {[3, 6, 9, 12].map(t => (
                            <option key={t} value={t}>{t} Bulan</option>
                        ))}
                    </select>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                  <Calculator className="text-blue-500 mt-1" size={20} />
                  <div className="w-full">
                      <p className="text-sm text-blue-700 font-medium mb-1">Estimasi Pelunasan</p>
                      <div className="flex justify-between text-xs text-blue-600 mb-1">
                          <span>Pokok:</span>
                          <span>{formatIDR(Number(formData.jumlah_pinjaman) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-blue-600 mb-2 border-b border-blue-200 pb-1">
                          <span>Bunga ({formData.bunga_persen}% x {formData.tenor_bulan} bln):</span>
                          <span>{formatIDR(estimasi.totalBunga)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-blue-800 mb-1">
                          <span>Total Hutang:</span>
                          <span>{formatIDR(estimasi.totalHutang)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                          <span>Angsuran:</span>
                          <span>{formatIDR(estimasi.angsuran)} / bln</span>
                      </div>
                  </div>
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
                    {loading ? 'Menyimpan...' : 'Simpan Pinjaman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinjamanPage;