import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/mockDatabase';
import { Transaksi, TransactionType, Role, Nasabah, Pinjaman } from '../types';
import { Plus, Trash2, Search, Filter, Download, CreditCard, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TransaksiPage = () => {
  const { user } = useAuth();
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [nasabahList, setNasabahList] = useState<Nasabah[]>([]);
  const [activeLoans, setActiveLoans] = useState<Pinjaman[]>([]); // Store active loans
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'general' | 'angsuran'>('general'); // Distinguish mode
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Form State
  const [formData, setFormData] = useState({
    id_nasabah: '',
    jenis_transaksi: TransactionType.SIMPANAN_SUKARELA as TransactionType,
    nominal: '',
    keterangan: ''
  });

  const refreshData = async () => {
    setLoading(true);
    try {
        let trx = await DatabaseService.getTransaksi();
        if (user?.role === Role.NASABAH) {
           trx = trx.filter(t => t.id_nasabah === user.id_nasabah);
        }
        setTransaksi(trx);

        // Fetch Nasabah & Pinjaman for context
        if (user?.role !== Role.NASABAH) {
            let ns = await DatabaseService.getNasabah();
            
            // Filter list nasabah agar Koordinator hanya bisa transaksi untuk nasabah inputannya
            if (user?.role === Role.KOORDINATOR) {
                ns = ns.filter(n => n.koordinator === user.username);
            }

            setNasabahList(ns);
            
            const loans = await DatabaseService.getPinjaman();
            setActiveLoans(loans.filter(l => l.status === 'aktif'));
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user, isModalOpen]);

  const openModal = (mode: 'general' | 'angsuran') => {
    setModalMode(mode);
    setFormData({
        id_nasabah: '',
        jenis_transaksi: mode === 'angsuran' ? TransactionType.ANGSURAN : TransactionType.SIMPANAN_SUKARELA,
        nominal: '',
        keterangan: ''
    });
    setIsModalOpen(true);
  };

  const handleNasabahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      
      // Default behavior
      let newNominal = formData.nominal;
      let newKeterangan = formData.keterangan;

      // Logic khusus Angsuran: Auto-fill nominal
      if (modalMode === 'angsuran') {
          const loan = activeLoans.find(l => l.id_nasabah === id);
          if (loan) {
              newNominal = String(loan.angsuran_bulanan);
              newKeterangan = `Angsuran Pinjaman ${loan.id_pinjaman}`;
          } else {
              newNominal = '';
              newKeterangan = '';
          }
      }

      setFormData({
          ...formData,
          id_nasabah: id,
          nominal: newNominal,
          keterangan: newKeterangan
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await DatabaseService.addTransaksi({
        id_nasabah: formData.id_nasabah,
        jenis_transaksi: formData.jenis_transaksi,
        nominal: Number(formData.nominal),
        koordinator: user?.username || 'system',
        keterangan: formData.keterangan || '-'
      }, user?.username || 'system');
      
      setIsModalOpen(false);
      alert("Transaksi Berhasil Disimpan!");
      await refreshData();
    } catch (err: any) {
      alert("Gagal: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah anda yakin ingin membatalkan transaksi ini? Saldo nasabah akan dikembalikan.")) {
        setLoading(true);
        await DatabaseService.deleteTransaksi(id, user?.username || 'system');
        await refreshData();
        setLoading(false);
    }
  };

  const filteredTrx = transaksi.filter(t => 
    filterType === 'all' ? true : t.jenis_transaksi === filterType
  );

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);

  // Helper to get active loan detail for selected nasabah in modal
  const selectedLoan = modalMode === 'angsuran' 
    ? activeLoans.find(l => l.id_nasabah === formData.id_nasabah) 
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
             {user?.role === Role.NASABAH ? 'Riwayat Transaksi' : 'Transaksi'}
          </h1>
          <p className="text-slate-500">Daftar mutasi simpanan dan penarikan</p>
        </div>
        
        {user?.role !== Role.NASABAH && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
                onClick={() => openModal('general')}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
                <Wallet size={18} />
                <span>Simpanan / Penarikan</span>
            </button>
            <button 
                onClick={() => openModal('angsuran')}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
                <CreditCard size={18} />
                <span>Input Angsuran</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
         {['all', TransactionType.SIMPANAN_WAJIB, TransactionType.SIMPANAN_SUKARELA, TransactionType.PENARIKAN, TransactionType.BAGI_HASIL].map(type => (
             <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                    filterType === type 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
             >
                 {type === 'all' ? 'Semua' : type.replace(/_/g, ' ')}
             </button>
         ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <div className="p-8 text-center text-slate-500">Memuat data...</div>}
        {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ID TRX</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Tanggal</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nasabah</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Jenis</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Nominal</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ket.</th>
                {user?.role === Role.ADMIN && <th className="px-6 py-4 text-sm font-semibold text-slate-600">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrx.map((trx) => {
                const isExpense = trx.jenis_transaksi === TransactionType.PENARIKAN || trx.jenis_transaksi === TransactionType.BAGI_HASIL;
                
                return (
                <tr key={trx.id_transaksi} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{trx.id_transaksi}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(trx.tanggal).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{trx.id_nasabah}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        trx.jenis_transaksi.includes('simpanan') ? 'bg-emerald-100 text-emerald-700' :
                        trx.jenis_transaksi === TransactionType.PENARIKAN ? 'bg-red-100 text-red-700' : 
                        trx.jenis_transaksi === TransactionType.BAGI_HASIL ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                        {trx.jenis_transaksi.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${
                      isExpense ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                      {isExpense ? '-' : '+'}{formatIDR(Math.abs(trx.nominal))}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{trx.keterangan}</td>
                  {user?.role === Role.ADMIN && (
                      <td className="px-6 py-4 text-sm">
                          <button 
                            onClick={() => handleDelete(trx.id_transaksi)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Hapus Transaksi"
                          >
                              <Trash2 size={18} />
                          </button>
                      </td>
                  )}
                </tr>
              )})}
              {filteredTrx.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Belum ada transaksi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal Input Transaksi */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">
                  {modalMode === 'angsuran' ? 'Input Angsuran Pinjaman' : 'Input Simpanan / Penarikan'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Nasabah</label>
                <select 
                    required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                    value={formData.id_nasabah}
                    onChange={handleNasabahChange}
                >
                    <option value="">-- Pilih Nasabah --</option>
                    {nasabahList.map(n => {
                        // Hint jika mode angsuran dan nasabah punya hutang
                        const hasLoan = activeLoans.some(l => l.id_nasabah === n.id_nasabah);
                        const label = modalMode === 'angsuran' && hasLoan 
                            ? `${n.id_nasabah} - ${n.nama} (Ada Tagihan)` 
                            : `${n.id_nasabah} - ${n.nama}`;
                        
                        return (
                            <option key={n.id_nasabah} value={n.id_nasabah}>
                                {label}
                            </option>
                        );
                    })}
                </select>
                {modalMode === 'angsuran' && formData.id_nasabah && !selectedLoan && (
                    <p className="text-xs text-red-500 mt-1">* Nasabah ini tidak memiliki pinjaman aktif.</p>
                )}
                 {modalMode === 'angsuran' && selectedLoan && (
                    <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded mt-2 border border-blue-100">
                        <strong>Info Pinjaman:</strong><br/>
                        Sisa Hutang: {formatIDR(selectedLoan.sisa_pinjaman)}<br/>
                        Angsuran per bulan: {formatIDR(selectedLoan.angsuran_bulanan)}
                    </div>
                )}
              </div>

              {modalMode === 'general' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Transaksi</label>
                    <select
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                        value={formData.jenis_transaksi}
                        onChange={(e) => setFormData({...formData, jenis_transaksi: e.target.value as TransactionType})}
                    >
                        <option value={TransactionType.SIMPANAN_WAJIB}>Simpanan Wajib (Bulanan)</option>
                        <option value={TransactionType.SIMPANAN_SUKARELA}>Simpanan Sukarela (Tabungan)</option>
                        <option value={TransactionType.PENARIKAN}>Penarikan Tunai (Dari Sukarela)</option>
                    </select>
                    {formData.jenis_transaksi === TransactionType.PENARIKAN && (
                        <p className="text-xs text-red-500 mt-1">* Penarikan hanya akan mengurangi Simpanan Sukarela.</p>
                    )}
                  </div>
              ) : (
                  // Hidden Input untuk Angsuran (Fixed Type)
                  <input type="hidden" value={TransactionType.ANGSURAN} />
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                <input 
                    type="number" required min="1000"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.nominal}
                    onChange={e => setFormData({...formData, nominal: e.target.value})}
                    placeholder="Contoh: 100000"
                />
                {modalMode === 'angsuran' && (
                    <p className="text-xs text-slate-400 mt-1">
                        *Otomatis terisi sesuai angsuran bulanan (bisa diedit jika bayar sebagian)
                    </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
                <input 
                    type="text" 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                    value={formData.keterangan}
                    onChange={e => setFormData({...formData, keterangan: e.target.value})}
                    placeholder="Opsional"
                />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-lg shadow-emerald-200 disabled:opacity-50">
                    {loading ? 'Memproses...' : (modalMode === 'angsuran' ? 'Bayar Angsuran' : 'Simpan Transaksi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransaksiPage;