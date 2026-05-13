import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/mockDatabase';
import { Nasabah, Transaksi, Role, TransactionType, Pinjaman } from '../types';
import { 
  Users, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Landmark,
  CreditCard,
  CalendarCheck,
  Coins
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, subtext, icon: Icon, color, isNegative }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-slate-800'}`}>{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
    <p className="text-xs text-slate-400">{subtext}</p>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [nasabah, setNasabah] = useState<Nasabah[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [stats, setStats] = useState({
    totalNasabah: 0,
    totalSimpanan: 0,
    totalPinjaman: 0,
    netBalance: 0,
    liquidBalance: 0, 
    interestRevenue: 0, 
    totalTransaksiHariIni: 0,
    uangMasukHariIni: 0,
    uangKeluarHariIni: 0
  });

  const fetchData = async () => {
      let allNasabah = await DatabaseService.getNasabah(); 
      let allTrx = await DatabaseService.getTransaksi();
      let allLoans = await DatabaseService.getPinjaman();

      if (user?.role === Role.NASABAH) {
        allNasabah = allNasabah.filter(n => n.id_nasabah === user.id_nasabah);
        allTrx = allTrx.filter(t => t.id_nasabah === user.id_nasabah);
        allLoans = allLoans.filter(l => l.id_nasabah === user.id_nasabah);
      }

      setNasabah(allNasabah);
      setTransaksi(allTrx);

      const today = new Date().toISOString().split('T')[0];
      const todayTrx = allTrx.filter(t => t.tanggal.startsWith(today));
      
      // 1. Total Modal Simpanan (Pokok + Wajib + Sukarela)
      const totalModalSimpanan = allNasabah.reduce((acc, curr) => 
        acc + (curr.simpanan_pokok||0) + (curr.simpanan_wajib||0) + (curr.simpanan_sukarela||0), 0
      );

      const totalPinjaman = allNasabah.reduce((acc, curr) => acc + (curr.total_pinjaman || 0), 0);
      const netBalance = totalModalSimpanan - totalPinjaman;
      
      let totalPrincipalDisbursed = 0;
      let totalRepaymentReceived = 0;
      let calculatedGrossInterestRevenue = 0;

      allLoans.forEach(loan => {
          const totalBunga = loan.jumlah_pinjaman * (loan.bunga_persen/100) * loan.tenor_bulan;
          const totalTagihan = loan.jumlah_pinjaman + totalBunga;
          const sisa = Math.max(0, loan.sisa_pinjaman);
          const terbayar = totalTagihan - sisa;

          totalPrincipalDisbursed += loan.jumlah_pinjaman;
          totalRepaymentReceived += terbayar;

          const ratioBunga = totalTagihan > 0 ? (totalBunga / totalTagihan) : 0;
          calculatedGrossInterestRevenue += (terbayar * ratioBunga);
      });
      
      // HITUNG BAGI HASIL YANG SUDAH KELUAR (EXPENSE)
      // Gunakan Math.abs karena di DB disimpan negatif
      const totalSHUDistributed = allTrx
        .filter(t => t.jenis_transaksi === TransactionType.BAGI_HASIL)
        .reduce((acc, curr) => acc + Math.abs(curr.nominal), 0);

      // LOGIKA BARU: 
      // Pendapatan Bunga Bersih = Gross Pendapatan - SHU yang sudah dibagikan
      const netInterestRevenue = Math.max(0, calculatedGrossInterestRevenue - totalSHUDistributed);

      // LOGIKA SALDO KAS KOPERASI:
      // Saldo Awal (Simpanan) - Pinjaman Keluar + Angsuran Masuk (Pokok+Bunga) - SHU Keluar
      // TotalRepaymentReceived sudah termasuk Bunga.
      const liquidBalance = totalModalSimpanan - totalPrincipalDisbursed + totalRepaymentReceived - totalSHUDistributed;

      // UPDATE: Uang Masuk/Keluar Hari Ini
      const uangMasuk = todayTrx
        .filter(t => t.jenis_transaksi !== TransactionType.PENARIKAN && t.jenis_transaksi !== TransactionType.BAGI_HASIL)
        .reduce((acc, curr) => acc + Math.abs(curr.nominal), 0);

      const uangKeluar = todayTrx
        .filter(t => t.jenis_transaksi === TransactionType.PENARIKAN || t.jenis_transaksi === TransactionType.BAGI_HASIL) 
        .reduce((acc, curr) => acc + Math.abs(curr.nominal), 0);

      setStats({
        totalNasabah: allNasabah.length,
        totalSimpanan: totalModalSimpanan, // Total Aset Simpanan (Tanpa SHU)
        totalPinjaman,
        netBalance,
        liquidBalance, // Saldo Kas Riil (Net of SHU Distribution)
        interestRevenue: netInterestRevenue, // RESET LABA (Laba Tersedia)
        totalTransaksiHariIni: todayTrx.length,
        uangMasukHariIni: uangMasuk,
        uangKeluarHariIni: uangKeluar
      });
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.KOORDINATOR;
  const isSuperAdmin = user?.role === Role.ADMIN;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">Ringkasan aktivitas keuangan koperasi</p>
        </div>
        
        {isSuperAdmin && (
            <Link 
                to="/tutup-buku"
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
            >
                <CalendarCheck size={18} />
                <span>Tutup Buku Tahunan</span>
            </Link>
        )}
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <StatCard 
                title="Saldo Kas Koperasi" 
                value={formatIDR(stats.liquidBalance)} 
                subtext="Total Nominal Kas Koperasi"
                icon={Landmark} 
                color="bg-indigo-600"
                isNegative={stats.liquidBalance < 0}
            />
            <StatCard 
                title="Pendapatan Bunga" 
                value={formatIDR(stats.interestRevenue)} 
                subtext="Laba Bersih (Tersedia)"
                icon={Coins} 
                color="bg-amber-500" 
            />
            <StatCard 
                title="Total Modal Simpanan" 
                value={formatIDR(stats.totalSimpanan)} 
                subtext="Pokok + Wajib + Sukarela"
                icon={Wallet} 
                color="bg-emerald-500" 
            />
            <StatCard 
                title="Sisa Piutang" 
                value={formatIDR(stats.totalPinjaman)} 
                subtext="Pokok + Bunga belum dibayar"
                icon={CreditCard} 
                color="bg-blue-500" 
            />
             <StatCard 
                title="Total Nasabah" 
                value={stats.totalNasabah} 
                subtext="Anggota aktif terdaftar"
                icon={Users} 
                color="bg-slate-500" 
            />
            <StatCard 
                title="Pemasukan Hari Ini" 
                value={formatIDR(stats.uangMasukHariIni)} 
                subtext="Dari Simpanan & Angsuran"
                icon={ArrowUpRight} 
                color="bg-green-500" 
            />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
                title="Total Simpanan" 
                value={formatIDR(stats.totalSimpanan)} 
                subtext="Aset simpanan anda (Tanpa SHU)"
                icon={Wallet} 
                color="bg-blue-500" 
            />
            <StatCard 
                title="Saldo Bersih" 
                value={formatIDR(stats.netBalance)} 
                subtext={`Simpanan dikurangi Pinjaman (${formatIDR(stats.totalPinjaman)})`}
                icon={Landmark} 
                color="bg-emerald-500"
                isNegative={stats.netBalance < 0}
            />
            <StatCard 
                title="Pemasukan Hari Ini" 
                value={formatIDR(stats.uangMasukHariIni)} 
                subtext="Simpanan & Angsuran"
                icon={ArrowUpRight} 
                color="bg-green-500" 
            />
            <StatCard 
                title="Pengeluaran Hari Ini" 
                value={formatIDR(stats.uangKeluarHariIni)} 
                subtext="Penarikan Tunai"
                icon={ArrowDownRight} 
                color="bg-orange-500" 
            />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;