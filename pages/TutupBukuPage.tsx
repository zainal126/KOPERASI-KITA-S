import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DatabaseService } from '../services/mockDatabase';
import { Nasabah, Pinjaman, TransactionType } from '../types';
import { Calculator, Save, AlertTriangle, Info, CheckCircle, TrendingUp, Wallet, ArrowRight, Plus, Users, Building2, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TutupBukuPage = () => {
  const { user } = useAuth();
  const [nasabah, setNasabah] = useState<Nasabah[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Inputs
  const [labaLain, setLabaLain] = useState<string>('0');
  
  // Sliders
  const [persenAnggota, setPersenAnggota] = useState<number>(70);
  
  // Stats
  const [finances, setFinances] = useState({
      accumulatedInterest: 0,
      distributedSHU: 0,
      availableProfit: 0
  });

  const fetchData = useCallback(async () => {
      setLoading(true);
      try {
        const dataNasabah = await DatabaseService.getNasabah();
        const dataPinjaman = await DatabaseService.getPinjaman();
        const dataTransaksi = await DatabaseService.getTransaksi();
        
        setNasabah(dataNasabah);

        // 1. HITUNG PEMASUKAN DARI BUNGA (Laba Kotor)
        let totalInterestCollected = 0;
        dataPinjaman.forEach(loan => {
            const totalBunga = loan.jumlah_pinjaman * (loan.bunga_persen/100) * loan.tenor_bulan;
            const totalTagihan = loan.jumlah_pinjaman + totalBunga;
            const sisa = Math.max(0, loan.sisa_pinjaman);
            const terbayar = totalTagihan - sisa;
            
            if (totalTagihan > 0) {
                const interestPart = (totalBunga / totalTagihan) * terbayar;
                totalInterestCollected += interestPart;
            }
        });

        // 2. HITUNG PENGELUARAN YANG SUDAH DIBAGI
        // Note: BAGI_HASIL is stored as negative in DB now, so use Math.abs
        const totalDistributed = dataTransaksi
            .filter(t => t.jenis_transaksi === TransactionType.BAGI_HASIL)
            .reduce((sum, t) => sum + Math.abs(t.nominal), 0);
        
        // 3. LABA TERSEDIA = PEMASUKAN - SUDAH DIBAGI
        const available = Math.max(0, totalInterestCollected - totalDistributed);

        setFinances({
            accumulatedInterest: totalInterestCollected,
            distributedSHU: totalDistributed,
            availableProfit: available
        });
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SIMULASI VISUAL (Termasuk Laba Manual)
  const simulation = useMemo(() => {
    // 1. Total Laba yang mau dieksekusi sekarang (VISUAL)
    const profitBase = finances.availableProfit;
    const totalProfit = profitBase + (Number(labaLain) || 0);
    
    const danaAnggota = Math.floor(totalProfit * (persenAnggota / 100));
    const danaKoperasi = totalProfit - danaAnggota; // Sisa uang

    // Filter nasabah aktif (kecuali akun sistem KOPERASI)
    const activeMembers = nasabah.filter(n => n.id_nasabah !== 'KOPERASI');

    const totalSimpananBasis = activeMembers.reduce((sum, n) => 
        sum + (n.simpanan_pokok || 0) + (n.simpanan_wajib || 0) + (n.simpanan_sukarela || 0), 0
    );
    
    // Hitung jatah per orang
    const results = activeMembers.map(n => {
        const memberSimpanan = (n.simpanan_pokok || 0) + (n.simpanan_wajib || 0) + (n.simpanan_sukarela || 0);
        const totalSHU = totalSimpananBasis > 0 
            ? (memberSimpanan / totalSimpananBasis) * danaAnggota 
            : 0;
        return { ...n, totalSHU: Math.floor(totalSHU) };
    });

    results.sort((a, b) => b.totalSHU - a.totalSHU);

    return {
        totalProfit,
        danaAnggota,
        danaKoperasi,
        totalSimpananBasis,
        results
    };
  }, [nasabah, finances.availableProfit, labaLain, persenAnggota]);

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const handleInitialClick = () => {
    setShowConfirmModal(true);
  };

  const executeDistribution = async () => {
      setProcessing(true);
      setShowConfirmModal(false);
      setProgress({ current: 0, total: 0 });

      try {
          // --- LOGIKA HYBRID (REAL & MANUAL) ---
          
          const manualProfit = Number(labaLain) || 0;
          const realProfit = finances.availableProfit;
          const totalProfitFull = realProfit + manualProfit;

          // Hitung Dana Real
          const realDanaAnggota = Math.floor(realProfit * (persenAnggota / 100));
          const realDanaKoperasi = realProfit - realDanaAnggota;

          // Hitung Dana Full (Real + Manual)
          const fullDanaAnggota = Math.floor(totalProfitFull * (persenAnggota / 100));
          const fullDanaKoperasi = totalProfitFull - fullDanaAnggota;

          const activeMembers = nasabah.filter(n => n.id_nasabah !== 'KOPERASI');
          const totalSimpananBasis = activeMembers.reduce((sum, n) => 
              sum + (n.simpanan_pokok || 0) + (n.simpanan_wajib || 0) + (n.simpanan_sukarela || 0), 0
          );

          // Hitung alokasi per user
          const allocations = activeMembers.map(n => {
              const memberSimpanan = (n.simpanan_pokok || 0) + (n.simpanan_wajib || 0) + (n.simpanan_sukarela || 0);
              
              const realNominal = totalSimpananBasis > 0 
                  ? Math.floor((memberSimpanan / totalSimpananBasis) * realDanaAnggota) 
                  : 0;
              
              const fullNominal = totalSimpananBasis > 0
                  ? Math.floor((memberSimpanan / totalSimpananBasis) * fullDanaAnggota)
                  : 0;

              return {
                  id_nasabah: n.id_nasabah,
                  realNominal: realNominal, // Untuk Transaksi (Cashflow)
                  fullNominal: fullNominal  // Untuk Saldo Nasabah (Display)
              };
          });

          await DatabaseService.distributeSHU(
              allocations, 
              realProfit, 
              realDanaKoperasi,
              totalProfitFull,
              fullDanaKoperasi,
              user?.username || 'admin',
              (current, total) => setProgress({ current, total })
          );
          
          alert(`Sukses! Pembagian SHU Selesai.\n\nNasabah menerima: ${formatIDR(fullDanaAnggota)}\n(Dicatat di Transaksi: ${formatIDR(realDanaAnggota)})`);
          setLabaLain('0'); 
          await fetchData(); 
          
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setProcessing(false);
          setProgress({ current: 0, total: 0 });
      }
  };

  return (
    <div className="space-y-6 relative">
      {/* PROCESSING OVERLAY */}
      {processing && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
                <Loader2 size={48} className="text-emerald-600 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Memproses Transaksi...</h3>
                <p className="text-slate-500 text-center mb-6">Mohon jangan tutup halaman ini.</p>
                
                {progress.total > 0 && (
                    <div className="w-full">
                        <div className="flex justify-between text-sm mb-2 text-slate-600 font-medium">
                            <span>Proses</span>
                            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-emerald-600 h-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-2">
                            {progress.current} dari {progress.total} transaksi
                        </p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" /> Konfirmasi Eksekusi
                    </h3>
                    <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800">
                        <p className="font-bold mb-1">Perhatian (Mode Hybrid):</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Saldo Nasabah:</strong> Akan bertambah total <strong>{formatIDR(simulation.danaAnggota)}</strong> (Real + Manual).</li>
                            <li><strong>Log Transaksi:</strong> Hanya mencatat <strong>{formatIDR(Math.floor(finances.availableProfit * (persenAnggota/100)))}</strong> (Real Profit saja).</li>
                            <li>Laba Manual (Rp {Number(labaLain).toLocaleString()}) dianggap sebagai injeksi langsung ke saldo tanpa mengurangi kas bunga.</li>
                        </ul>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-3 mt-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Dana Dibagikan</p>
                        <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <span className="text-emerald-800">Total SHU ke Anggota</span>
                            <span className="font-bold text-emerald-800 text-lg">{formatIDR(simulation.danaAnggota)}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 flex gap-3 justify-end border-t border-slate-100">
                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="px-4 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={executeDistribution}
                        className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95"
                    >
                        Ya, Eksekusi
                    </button>
                </div>
            </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tutup Buku & Reset Laba</h1>
        <p className="text-slate-500">Bagikan SHU ke anggota dan reset saldo laba berjalan.</p>
      </div>

      {/* PROFIT CALCULATOR */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-emerald-300">
              <Calculator size={20} />
              Laba Bersih Tersedia 
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8 items-center">
              {/* Laba Bunga */}
              <div className="space-y-1">
                  <p className="text-sm text-slate-400">Total Bunga Pinjaman</p>
                  <p className="text-4xl font-bold text-white">{formatIDR(finances.availableProfit)}</p>
                  <p className="text-[10px] text-slate-500">
                      (Total Pendapatan dari Bunga Pinjaman)
                  </p>
              </div>

              <div className="hidden md:flex justify-center text-slate-500"><Plus size={32} /></div>

              {/* Laba Lain */}
              <div className="space-y-1">
                  <p className="text-sm text-amber-400 font-medium">Laba usaha lainnya</p>
                  <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                      <input 
                        type="number" min="0"
                        className="w-full pl-10 pr-4 py-2 bg-white/10 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono text-lg text-white placeholder-slate-400"
                        value={labaLain}
                        onChange={(e) => setLabaLain(e.target.value)}
                      />
                  </div>
                  <p className="text-[10px] text-amber-200 italic">*pendapatan dari bidang usaha koperasi lainnya.</p>
              </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                      <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider">Total Dibagikan ke Nasabah</p>
                      <p className="text-2xl font-bold text-white mt-1">{formatIDR(simulation.totalProfit)}</p>
                  </div>
              </div>
          </div>
      </div>

      {/* Control Panel Allocation */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-700 mb-6">Pengaturan Persentase SHU</h3>
          <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Anggota */}
              <div className="space-y-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-emerald-800 flex items-center gap-2"><Users size={18} /> Dibagi ke Anggota/Nasabah</label>
                      <span className="text-lg font-bold text-emerald-600">{persenAnggota}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={persenAnggota} onChange={(e) => setPersenAnggota(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
                  <p className="text-xl font-bold text-emerald-700 text-right">{formatIDR(simulation.danaAnggota)}</p>
              </div>
              {/* Pengurus / Sisa */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Building2 size={18} /> Operasional Pengelola Koperasi</label>
                      <span className="text-lg font-bold text-slate-600">{100 - persenAnggota}%</span>
                  </div>
                   <div className="w-full h-2 bg-slate-200 rounded-lg">
                       <div className="h-full bg-slate-400 rounded-lg" style={{width: `${100-persenAnggota}%`}}></div>
                   </div>
                  <p className="text-xl font-bold text-slate-700 text-right">{formatIDR(simulation.danaKoperasi)}</p>
                  <p className="text-xs text-slate-500 text-right italic">*Dana ini dikembalikan ke kas simpanan koperasi.</p>
              </div>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Rincian Pembagian SHU</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-200">Menampilkan Total</span>
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Nasabah/Anggota</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Modal Simpanan</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-800 uppercase text-right">Pembagian SHU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {simulation.results.slice(0, 50).map((r) => (
                <tr key={r.id_nasabah}>
                  <td className="px-6 py-3 text-sm font-medium text-slate-800">{r.nama}</td>
                  <td className="px-6 py-3 text-sm text-slate-600 text-right font-mono">{formatIDR((r.simpanan_pokok||0)+(r.simpanan_wajib||0)+(r.simpanan_sukarela||0))}</td>
                  <td className="px-6 py-3 text-sm text-emerald-700 text-right font-bold bg-emerald-50">{formatIDR(r.totalSHU)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 pt-4 pb-12">
          {simulation.totalProfit <= 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded">
                <AlertTriangle size={14} className="inline mr-1" />
                Laba 0, namun tombol tetap aktif untuk reset manual jika diperlukan.
              </p>
          )}

          <button
            type="button"
            onClick={handleInitialClick}
            disabled={processing} 
            className="flex items-center gap-2 px-8 py-4 rounded-xl transition-all shadow-lg bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95 shadow-emerald-200 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
          >
              <CheckCircle size={24} />
              <span className="font-bold text-lg">Eksekusi Pembagian</span>
          </button>
      </div>
    </div>
  );
};

export default TutupBukuPage;