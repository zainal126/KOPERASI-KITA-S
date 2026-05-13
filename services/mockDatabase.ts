import { User, Nasabah, Transaksi, Pinjaman, LogAktivitas, Role, TransactionType } from '../types';

// Link Deployment dari User (HARDCODED)
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCuxUF8izPweS1NGy4O8zHp5sCop1jl9oBCTLVBHvYK2HpSDBII-wozz48eCc2D_fISQ/exec';

const DB_KEYS = {
  USERS: 'koperasi_users',
  NASABAH: 'koperasi_nasabah',
  TRANSAKSI: 'koperasi_transaksi',
  PINJAMAN: 'koperasi_pinjaman',
  LOGS: 'koperasi_logs',
};

// --- LOCAL STORAGE HELPERS (FALLBACK/CACHE) ---
const loadLocal = <T,>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initial;
};

const saveLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export class DatabaseService {
  
  static offlineMode = false; // Flag to track if API is down

  static get scriptUrl() {
    return DEFAULT_SCRIPT_URL;
  }

  static get useApi() {
    return !!this.scriptUrl && !this.offlineMode;
  }

  // --- GAS API HELPERS ---

  private static async fetchGAS(sheetName: string) {
    if (!this.useApi) throw new Error("Offline Mode");
    try {
        const response = await fetch(`${this.scriptUrl}?sheet=${sheetName}&action=read`);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const result = await response.json();
        if (result.status === 'success') {
            return result.data;
        }
        if (result.message && result.message.includes('Sheet not found')) {
            throw new Error(`Sheet ${sheetName} missing. Check backend.`);
        }
        throw new Error(result.message || 'Fetch failed');
    } catch (e) {
        console.warn(`GAS Fetch Error (${sheetName}):`, e);
        this.offlineMode = true; // Switch to offline mode automatically
        throw e;
    }
  }

  private static async postGAS(action: 'create' | 'update' | 'delete', sheetName: string, data: any = {}, id?: string) {
    if (!this.useApi) throw new Error("Offline Mode");
    try {
        const payload = {
            action,
            sheet: sheetName,
            data,
            id
        };

        const response = await fetch(this.scriptUrl!, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.error || result.message || 'Operation failed');
        }
        return result;
    } catch (e) {
        console.warn(`GAS Post Error (${action} ${sheetName}):`, e);
        this.offlineMode = true; // Switch to offline mode automatically
        throw e;
    }
  }

  // --- READ METHODS ---

  static async getUsers(): Promise<any[]> {
    try {
      if (this.useApi) {
          const data = await this.fetchGAS('Users');
          return data;
      }
    } catch (e) { /* Ignore API error, fallthrough to local */ }
    return loadLocal(DB_KEYS.USERS, []);
  }

  static async getNasabah(): Promise<Nasabah[]> {
    let nasabahList: Nasabah[] = [];
    
    // 1. Fetch Basic Nasabah Data
    try {
        if (this.useApi) {
            const data = await this.fetchGAS('Nasabah');
            nasabahList = data.map((d: any) => ({
                ...d, 
                id_nasabah: String(d.id_nasabah), 
                nik: String(d.nik),
                simpanan_pokok: Number(d.simpanan_pokok || 0),
                simpanan_wajib: Number(d.simpanan_wajib || 0),
                simpanan_sukarela: Number(d.simpanan_sukarela || d.saldo || 0),
                shu: Number(d.shu || 0),
                saldo: 0, // Recalculated below
                koordinator: d.koordinator || ''
            }));
        } else {
             throw new Error("Offline");
        }
    } catch (e) { 
        nasabahList = loadLocal(DB_KEYS.NASABAH, []); 
    }

    // 2. Fetch Loans to calculate Net Balance
    try {
        const loans = await this.getPinjaman();
        
        return nasabahList.map(n => {
            const totalDebt = loans
                .filter(l => l.id_nasabah === n.id_nasabah && l.status === 'aktif')
                .reduce((sum, loan) => sum + loan.sisa_pinjaman, 0);
            
            const totalSimpanan = (n.simpanan_pokok || 0) + (n.simpanan_wajib || 0) + (n.simpanan_sukarela || 0) + (n.shu || 0);

            return {
                ...n,
                saldo: totalSimpanan,
                total_pinjaman: totalDebt
            };
        });
    } catch (e) {
        console.error("Error calculating loans for nasabah", e);
        return nasabahList;
    }
  }

  static async getTransaksi(): Promise<Transaksi[]> {
    try {
        if (this.useApi) {
            const data = await this.fetchGAS('Transaksi');
            return data.map((d: any) => ({...d, nominal: Number(d.nominal)}));
        }
    } catch (e) { /* Fallthrough */ }
    return loadLocal(DB_KEYS.TRANSAKSI, []);
  }

  static async getPinjaman(): Promise<Pinjaman[]> {
    try {
        if (this.useApi) {
            const data = await this.fetchGAS('Pinjaman');
            return data.map((d: any) => ({
                id_pinjaman: d.id_pinjaman,
                id_nasabah: String(d.id_nasabah),
                jumlah_pinjaman: Number(d.jumlah_pinjaman),
                bunga_persen: Number(d.bunga_persen || 0),
                tenor_bulan: Number(d.tenor_bulan),
                angsuran_bulanan: Number(d.angsuran_bulanan),
                sisa_pinjaman: Number(d.sisa_pinjaman),
                status: d.status && d.status !== '' ? d.status : (Number(d.sisa_pinjaman) > 0 ? 'aktif' : 'lunas')
            }));
        }
    } catch (e) { /* Fallthrough */ }
    return loadLocal(DB_KEYS.PINJAMAN, []);
  }

  // --- WRITE METHODS (With Fallback) ---

  static async logAktivitas(user: string, aktivitas: string) {
    const newLog: LogAktivitas = {
      id: Date.now().toString(),
      waktu: new Date().toISOString(),
      user,
      aktivitas
    };
    try {
        if (this.useApi) {
            await this.postGAS('create', 'Logs', newLog);
            return;
        }
    } catch(e) { /* Ignore log errors */ }
    
    // Local Log
    const logs = loadLocal<LogAktivitas[]>(DB_KEYS.LOGS, []);
    logs.push(newLog);
    saveLocal(DB_KEYS.LOGS, logs);
  }

  static async createUser(data: any, actor: string) {
      try {
          if(this.useApi) {
              await this.postGAS('create', 'Users', data);
              await this.logAktivitas(actor, `Buat Staff Baru: ${data.username}`);
              return;
          }
      } catch(e) { /* Fallback */ }

      const users = loadLocal<any[]>(DB_KEYS.USERS, []);
      users.push(data);
      saveLocal(DB_KEYS.USERS, users);
      await this.logAktivitas(actor, `Buat Staff Baru (Local): ${data.username}`);
  }

  static async updateUser(id: string, data: any, actor: string) {
      try {
          if(this.useApi) {
              await this.postGAS('update', 'Users', data, id);
              await this.logAktivitas(actor, `Update Staff: ${id}`);
              return;
          }
      } catch(e) { /* Fallback */ }

      const users = loadLocal<any[]>(DB_KEYS.USERS, []);
      const idx = users.findIndex(u => String(u.id) === String(id));
      if (idx !== -1) {
          users[idx] = { ...users[idx], ...data };
          saveLocal(DB_KEYS.USERS, users);
      }
      await this.logAktivitas(actor, `Update Staff (Local): ${id}`);
  }

  static async deleteUser(id: string, actor: string) {
      try {
          if(this.useApi) {
              await this.postGAS('delete', 'Users', {}, id);
              await this.logAktivitas(actor, `Hapus Staff: ${id}`);
              return;
          }
      } catch(e) { /* Fallback */ }

      let users = loadLocal<any[]>(DB_KEYS.USERS, []);
      users = users.filter(u => String(u.id) !== String(id));
      saveLocal(DB_KEYS.USERS, users);
      await this.logAktivitas(actor, `Hapus Staff (Local): ${id}`);
  }

  static async addNasabah(nasabah: Nasabah, actor: string) {
    const { total_pinjaman, saldo, ...payload } = nasabah;

    try {
        if (this.useApi) {
            await this.postGAS('create', 'Nasabah', payload);
            await this.logAktivitas(actor, `Tambah Nasabah: ${nasabah.nama}`);
            return;
        }
    } catch(e) { /* Fallback */ }

    const list = loadLocal<Nasabah[]>(DB_KEYS.NASABAH, []);
    list.push(nasabah);
    saveLocal(DB_KEYS.NASABAH, list);
    await this.logAktivitas(actor, `Tambah Nasabah (Local): ${nasabah.nama}`);
  }

  static async updateNasabah(id: string, data: Partial<Nasabah>, actor: string) {
    const { total_pinjaman, saldo, ...cleanData } = data;
    
    try {
        if (this.useApi) {
            await this.postGAS('update', 'Nasabah', cleanData, id);
            await this.logAktivitas(actor, `Edit Nasabah: ${id}`);
            return;
        }
    } catch(e) { /* Fallback */ }

    const list = loadLocal<Nasabah[]>(DB_KEYS.NASABAH, []);
    const idx = list.findIndex(n => n.id_nasabah === id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...cleanData };
        saveLocal(DB_KEYS.NASABAH, list);
    }
    await this.logAktivitas(actor, `Edit Nasabah (Local): ${id}`);
  }

  static async createPinjaman(data: Omit<Pinjaman, 'status'>, actor: string) {
    const newLoan = { ...data, status: 'aktif' as const };
    
    try {
        if (this.useApi) {
            await this.postGAS('create', 'Pinjaman', newLoan);
            await this.logAktivitas(actor, `Buat Pinjaman Baru: ${data.id_pinjaman}`);
            return;
        }
    } catch(e) { /* Fallback */ }

    const loans = loadLocal<Pinjaman[]>(DB_KEYS.PINJAMAN, []);
    loans.push(newLoan);
    saveLocal(DB_KEYS.PINJAMAN, loans);
    await this.logAktivitas(actor, `Buat Pinjaman Baru (Local): ${data.id_pinjaman}`);
  }

  static async addTransaksi(trx: Omit<Transaksi, 'id_transaksi' | 'tanggal'>, actor: string, preloadedNasabah?: Nasabah) {
    let nasabah = preloadedNasabah;
    
    // Always fetch latest nasabah state to ensure sync
    const nasabahList = await this.getNasabah();
    nasabah = nasabahList.find(n => n.id_nasabah === trx.id_nasabah);

    if (!nasabah) throw new Error("Nasabah tidak ditemukan: " + trx.id_nasabah);

    const updates: Partial<Nasabah> = {};
    const absNominal = Math.abs(trx.nominal); // Ensure we use absolute for calculations
    
    if (trx.jenis_transaksi === TransactionType.SIMPANAN_POKOK) {
        updates.simpanan_pokok = (nasabah.simpanan_pokok || 0) + absNominal;
    } 
    else if (trx.jenis_transaksi === TransactionType.SIMPANAN_WAJIB) {
        updates.simpanan_wajib = (nasabah.simpanan_wajib || 0) + absNominal;
    }
    else if (trx.jenis_transaksi === TransactionType.SIMPANAN_SUKARELA) {
        updates.simpanan_sukarela = (nasabah.simpanan_sukarela || 0) + absNominal;
    }
    else if (trx.jenis_transaksi === TransactionType.PENARIKAN) {
        const currentSukarela = nasabah.simpanan_sukarela || 0;
        if (currentSukarela < absNominal) {
            throw new Error(`Saldo Sukarela tidak cukup (Rp${currentSukarela})`);
        }
        updates.simpanan_sukarela = currentSukarela - absNominal;
    }
    else if (trx.jenis_transaksi === TransactionType.BAGI_HASIL) {
        updates.shu = (nasabah.shu || 0) + absNominal;
    }
    else if (trx.jenis_transaksi === TransactionType.ANGSURAN) {
       await this.bayarAngsuran(trx.id_nasabah, absNominal);
    }

    // Determine stored nominal sign
    // PENARIKAN and BAGI_HASIL should be negative in the database/spreadsheet
    let dbNominal = absNominal;
    if (trx.jenis_transaksi === TransactionType.PENARIKAN || trx.jenis_transaksi === TransactionType.BAGI_HASIL) {
        dbNominal = -absNominal;
    }

    const newTrx: Transaksi = {
        ...trx,
        nominal: dbNominal,
        id_transaksi: `TRX-${Date.now().toString().slice(-6)}`,
        tanggal: new Date().toISOString()
    };

    // --- TRY API ---
    try {
        if (this.useApi) {
            await this.postGAS('create', 'Transaksi', newTrx);
            if (Object.keys(updates).length > 0) {
                await this.postGAS('update', 'Nasabah', updates, nasabah.id_nasabah);
            }
            await this.logAktivitas(actor, `Input ${trx.jenis_transaksi}: Rp${dbNominal} (${trx.id_nasabah})`);
            return;
        }
    } catch(e) { /* Fallback */ }

    // --- LOCAL FALLBACK ---
    const localTrx = loadLocal<Transaksi[]>(DB_KEYS.TRANSAKSI, []);
    localTrx.push(newTrx);
    saveLocal(DB_KEYS.TRANSAKSI, localTrx);

    if (Object.keys(updates).length > 0) {
        const localNasabah = loadLocal<Nasabah[]>(DB_KEYS.NASABAH, []);
        const idx = localNasabah.findIndex(n => n.id_nasabah === nasabah!.id_nasabah);
        if (idx !== -1) {
            localNasabah[idx] = { ...localNasabah[idx], ...updates };
            saveLocal(DB_KEYS.NASABAH, localNasabah);
        }
    }
    await this.logAktivitas(actor, `Input ${trx.jenis_transaksi} (Local): Rp${dbNominal}`);
  }

  static async distributeSHU(
      allocations: { id_nasabah: string, realNominal: number, fullNominal: number }[], 
      totalLabaReal: number, 
      sisaUntukKoperasiReal: number,
      totalLabaFull: number,
      sisaUntukKoperasiFull: number, 
      actor: string,
      onProgress?: (current: number, total: number) => void
  ) {
      const nasabahList = await this.getNasabah();
      let koperasiAcc = nasabahList.find(n => n.id_nasabah === 'KOPERASI');
      
      if (!koperasiAcc) {
          const newKoperasi: Nasabah = {
              id_nasabah: 'KOPERASI',
              nama: 'Kas Cadangan Koperasi',
              nik: 'SYSTEM',
              alamat: 'Kantor Koperasi',
              no_hp: '-',
              simpanan_pokok: 0, simpanan_wajib: 0, simpanan_sukarela: 0, shu: 0, saldo: 0
          };
          await this.addNasabah(newKoperasi, 'system');
          koperasiAcc = newKoperasi;
      }

      // We only process allocations that have value (real OR full)
      const activeAllocations = allocations.filter(a => a.fullNominal > 0);
      let processedCount = 0;
      const totalCount = activeAllocations.length + 1; // +1 for Koperasi

      for (const allocation of activeAllocations) {
          const targetNasabah = nasabahList.find(n => n.id_nasabah === allocation.id_nasabah);
          if (targetNasabah) {
              
              // 1. Catat Transaksi & Update SHU (Hanya Nominal Real / Bunga)
              // Ini menjaga Saldo Kas Koperasi tetap sinkron dengan uang bunga fisik
              if (allocation.realNominal > 0) {
                  await this.addTransaksi({
                      id_nasabah: allocation.id_nasabah,
                      jenis_transaksi: TransactionType.BAGI_HASIL,
                      nominal: allocation.realNominal,
                      koordinator: 'system',
                      keterangan: `SHU Anggota (Real)`
                  }, actor, targetNasabah);
              }

              // 2. Jika ada selisih (Formalitas/Manual), update SHU Nasabah secara langsung
              // tanpa membuat transaksi.
              const diff = allocation.fullNominal - allocation.realNominal;
              if (diff > 0) {
                  // Kita perlu fetch data terbaru karena addTransaksi di atas sudah mengubah SHU
                  // Agar aman, kita fetch lagi (walaupun agak lambat, tapi aman untuk data)
                  const freshList = await this.getNasabah();
                  const freshTarget = freshList.find(n => n.id_nasabah === allocation.id_nasabah);
                  if (freshTarget) {
                      const newSHU = (freshTarget.shu || 0) + diff;
                      await this.updateNasabah(freshTarget.id_nasabah, { shu: newSHU }, 'system');
                  }
              }
              
              processedCount++;
              if (onProgress) onProgress(processedCount, totalCount);
          }
      }

      // Process KOPERASI Reserve
      // Sama seperti anggota: Transaksi catat Real, Profil catat Full
      if (sisaUntukKoperasiReal > 0 && koperasiAcc) {
          await this.addTransaksi({
              id_nasabah: 'KOPERASI',
              jenis_transaksi: TransactionType.BAGI_HASIL,
              nominal: sisaUntukKoperasiReal,
              koordinator: 'system',
              keterangan: 'Reset Laba Real (Masuk Kas Koperasi)'
          }, actor, koperasiAcc);
      }
      
      const diffKoperasi = sisaUntukKoperasiFull - sisaUntukKoperasiReal;
      if (diffKoperasi > 0) {
           const freshList = await this.getNasabah();
           const freshKoperasi = freshList.find(n => n.id_nasabah === 'KOPERASI');
           if (freshKoperasi) {
                const newSHU = (freshKoperasi.shu || 0) + diffKoperasi;
                await this.updateNasabah('KOPERASI', { shu: newSHU }, 'system');
           }
      }

      processedCount++;
      if (onProgress) onProgress(processedCount, totalCount);

      await this.logAktivitas(actor, `Tutup Buku Selesai. Total Real ${totalLabaReal}, Total Full ${totalLabaFull}.`);
  }

  static async bayarAngsuran(idNasabah: string, nominal: number) {
    // Note: getPinjaman() already handles API/Local fetch
    const loans = await this.getPinjaman();
    const loan = loans.find(l => l.id_nasabah === idNasabah && l.sisa_pinjaman > 0);
    
    if (loan) {
        let newSisa = loan.sisa_pinjaman - nominal;
        if (newSisa < 0) newSisa = 0;
        const status = newSisa === 0 ? 'lunas' : 'aktif';
        
        try {
            if (this.useApi) {
                const payload: any = { sisa_pinjaman: newSisa };
                if (newSisa === 0) payload.status = 'lunas';
                await this.postGAS('update', 'Pinjaman', payload, loan.id_pinjaman);
                return;
            }
        } catch(e) { /* Fallback */ }

        // Local Fallback
        const localLoans = loadLocal<Pinjaman[]>(DB_KEYS.PINJAMAN, []);
        const idx = localLoans.findIndex(l => l.id_pinjaman === loan.id_pinjaman);
        if(idx !== -1) {
             localLoans[idx].sisa_pinjaman = newSisa;
             if (newSisa === 0) localLoans[idx].status = 'lunas';
             saveLocal(DB_KEYS.PINJAMAN, localLoans);
        }
    }
  }

  static async deleteTransaksi(id: string, actor: string) {
    const allTrx = await this.getTransaksi();
    const trx = allTrx.find(t => t.id_transaksi === id);
    if (!trx) return;

    // Logic Revert Saldo
    const revertUpdates: Partial<Nasabah> = {};
    const nasabahList = await this.getNasabah();
    const nasabah = nasabahList.find(n => n.id_nasabah === trx.id_nasabah);
    const absNominal = Math.abs(trx.nominal); // Use absolute value for reverting

    if (nasabah) {
        if (trx.jenis_transaksi === TransactionType.SIMPANAN_POKOK) {
            revertUpdates.simpanan_pokok = Math.max(0, (nasabah.simpanan_pokok || 0) - absNominal);
        }
        else if (trx.jenis_transaksi === TransactionType.SIMPANAN_WAJIB) {
            revertUpdates.simpanan_wajib = Math.max(0, (nasabah.simpanan_wajib || 0) - absNominal);
        }
        else if (trx.jenis_transaksi === TransactionType.SIMPANAN_SUKARELA) {
            revertUpdates.simpanan_sukarela = Math.max(0, (nasabah.simpanan_sukarela || 0) - absNominal);
        }
        else if (trx.jenis_transaksi === TransactionType.PENARIKAN) {
            // Revert Penarikan means adding money back
            revertUpdates.simpanan_sukarela = (nasabah.simpanan_sukarela || 0) + absNominal;
        }
        else if (trx.jenis_transaksi === TransactionType.BAGI_HASIL) {
            // Revert Bagi Hasil means removing SHU
            revertUpdates.shu = Math.max(0, (nasabah.shu || 0) - absNominal);
        }
    }

    try {
        if (this.useApi) {
            if (Object.keys(revertUpdates).length > 0 && nasabah) {
                 await this.postGAS('update', 'Nasabah', revertUpdates, nasabah.id_nasabah);
            }
            await this.postGAS('delete', 'Transaksi', {}, id);
            await this.logAktivitas(actor, `Hapus Transaksi: ${id}`);
            return;
        }
    } catch(e) { /* Fallback */ }

    // Local Fallback
    let localTrx = loadLocal<Transaksi[]>(DB_KEYS.TRANSAKSI, []);
    localTrx = localTrx.filter(t => t.id_transaksi !== id);
    saveLocal(DB_KEYS.TRANSAKSI, localTrx);

    if (Object.keys(revertUpdates).length > 0 && nasabah) {
        const localNasabah = loadLocal<Nasabah[]>(DB_KEYS.NASABAH, []);
        const idx = localNasabah.findIndex(n => n.id_nasabah === nasabah.id_nasabah);
        if (idx !== -1) {
            localNasabah[idx] = { ...localNasabah[idx], ...revertUpdates };
            saveLocal(DB_KEYS.NASABAH, localNasabah);
        }
    }
    await this.logAktivitas(actor, `Hapus Transaksi (Local): ${id}`);
  }
}