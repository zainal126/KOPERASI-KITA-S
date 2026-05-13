export enum Role {
  ADMIN = 'admin',
  KOORDINATOR = 'koordinator',
  NASABAH = 'nasabah'
}

export enum TransactionType {
  SIMPANAN_POKOK = 'simpanan_pokok',
  SIMPANAN_WAJIB = 'simpanan_wajib',
  SIMPANAN_SUKARELA = 'simpanan_sukarela',
  PENARIKAN = 'penarikan',
  ANGSURAN = 'angsuran',
  BAGI_HASIL = 'bagi_hasil'
}

export interface User {
  id: string;
  nama: string;
  username: string;
  role: Role;
  id_nasabah?: string; // Links user to nasabah data if role is nasabah
}

export interface Nasabah {
  id_nasabah: string;
  nama: string;
  nik: string;
  alamat: string;
  no_hp: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  shu: number; // Akumulasi SHU yang diterima
  koordinator?: string; // Username of the coordinator who added this member
  total_pinjaman?: number; // Virtual field for display purposes (calculated from Pinjaman)
  saldo?: number; // Virtual field for Total Assets
}

export interface Transaksi {
  id_transaksi: string;
  tanggal: string; // ISO String
  id_nasabah: string;
  jenis_transaksi: TransactionType;
  nominal: number;
  koordinator: string; // Username of coordinator/admin
  keterangan: string;
}

export interface Pinjaman {
  id_pinjaman: string;
  id_nasabah: string;
  jumlah_pinjaman: number; // Pokok Pinjaman
  bunga_persen: number; // Persentase Bunga per Bulan
  tenor_bulan: number;
  angsuran_bulanan: number;
  sisa_pinjaman: number; // Total Hutang (Pokok + Bunga - Bayar)
  status: 'aktif' | 'lunas';
}

export interface LogAktivitas {
  id: string;
  waktu: string;
  user: string;
  aktivitas: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}