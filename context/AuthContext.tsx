import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { DatabaseService } from '../services/mockDatabase';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check local storage for persisted session
    const storedUser = localStorage.getItem('koperasi_session');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const inputUser = String(username).trim();
      const inputPass = String(password).trim();

      console.log("Attempting login for:", inputUser);

      // 1. Cek Login untuk ADMIN / KOORDINATOR (Sheet Users)
      // Mengambil data Users dari API
      const users: any[] = await DatabaseService.getUsers();
      
      const foundStaff = users.find(u => {
        // Handle various column names that might exist in older sheet versions
        const dbPass = String(u.password || u.Pass || '').trim();
        const dbUser = String(u.username).trim();
        return dbUser === inputUser && dbPass === inputPass;
      });

      if (foundStaff) {
        // Ensure role is valid
        const role = (foundStaff.role === Role.ADMIN || foundStaff.role === Role.KOORDINATOR) 
                     ? foundStaff.role 
                     : Role.KOORDINATOR;

        const loggedUser: User = {
          id: String(foundStaff.id),
          nama: foundStaff.nama,
          username: foundStaff.username,
          role: role as Role,
        };
        setUser(loggedUser);
        localStorage.setItem('koperasi_session', JSON.stringify(loggedUser));
        DatabaseService.logAktivitas(loggedUser.username, `Login Staff (${role}) berhasil`);
        return true;
      }

      // 2. Cek Login untuk NASABAH (Sheet Nasabah)
      // Username = ID Nasabah, Password = NIK
      // Logic ini memastikan integrasi otomatis: Data di sheet Nasabah ADALAH akun loginnya.
      const nasabahList = await DatabaseService.getNasabah();
      const foundNasabah = nasabahList.find(n => 
        String(n.id_nasabah).trim() === inputUser && 
        String(n.nik).trim() === inputPass
      );

      if (foundNasabah) {
        const loggedUser: User = {
          id: foundNasabah.id_nasabah,
          nama: foundNasabah.nama,
          username: foundNasabah.id_nasabah,
          role: Role.NASABAH,
          id_nasabah: foundNasabah.id_nasabah
        };
        setUser(loggedUser);
        localStorage.setItem('koperasi_session', JSON.stringify(loggedUser));
        DatabaseService.logAktivitas(foundNasabah.id_nasabah, 'Login Nasabah berhasil');
        return true;
      }

    } catch (e) {
      console.error("Login error", e);
    }
    return false;
  };

  const logout = () => {
    if (user) {
      DatabaseService.logAktivitas(user.username, 'Logout');
    }
    setUser(null);
    localStorage.removeItem('koperasi_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};