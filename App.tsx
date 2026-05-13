import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Role } from './types';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Wallet, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  UserCircle,
  Shield,
  BookOpen
} from 'lucide-react';

// Pages imports (defined in same file for single-file requirement handling, but separated conceptually)
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import NasabahPage from './pages/NasabahPage';
import TransaksiPage from './pages/TransaksiPage';
import PinjamanPage from './pages/PinjamanPage';
import UsersPage from './pages/UsersPage';
import TutupBukuPage from './pages/TutupBukuPage';

// --- COMPONENTS ---

interface SidebarItemProps {
  icon: any;
  label: string;
  to: string;
  active: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, to, active }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active 
      ? 'bg-emerald-600 text-white shadow-md' 
      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) return <Navigate to="/login" />;

  const isActive = (path: string) => location.pathname === path;

  // Define menu items based on role
  const menuItems: { icon: any; label: string; path: string }[] = [];
  
  // Dashboard for everyone
  menuItems.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/' });

  // Nasabah/Members management
  if (user.role === Role.ADMIN || user.role === Role.KOORDINATOR) {
    menuItems.push({ icon: Users, label: 'Data Nasabah', path: '/nasabah' });
  }

  // Transactions
  if (user.role === Role.ADMIN || user.role === Role.KOORDINATOR) {
    menuItems.push({ icon: Wallet, label: 'Transaksi', path: '/transaksi' });
  } else if (user.role === Role.NASABAH) {
     menuItems.push({ icon: Wallet, label: 'Riwayat Transaksi', path: '/riwayat' });
  }

  // Loans
  if (user.role === Role.ADMIN || user.role === Role.KOORDINATOR) {
     menuItems.push({ icon: CreditCard, label: 'Pinjaman', path: '/pinjaman' });
  } else if (user.role === Role.NASABAH) {
     menuItems.push({ icon: CreditCard, label: 'Pinjaman Saya', path: '/pinjaman-saya' });
  }

  // Tutup Buku (Admin Only)
  if (user.role === Role.ADMIN) {
    menuItems.push({ icon: BookOpen, label: 'Tutup Buku', path: '/tutup-buku' });
  }

  // Staff Management (Admin Only)
  if (user.role === Role.ADMIN) {
      menuItems.push({ icon: Shield, label: 'Manajemen Staf', path: '/users' });
  }

  // Profile (Nasabah only shown explicitly in menu, others in header)
  if (user.role === Role.NASABAH) {
    menuItems.push({ icon: UserCircle, label: 'Profil Saya', path: '/profil' });
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-emerald-700">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">K</div>
            <span className="text-xl font-bold tracking-tight">KoperasiKita</span>
          </div>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="text-slate-500">
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem 
              key={item.path} 
              icon={item.icon} 
              label={item.label} 
              to={item.path} 
              active={isActive(item.path)} 
            />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-30">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:bg-slate-100 p-2 rounded-lg"
          >
            <Menu size={24} />
          </button>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.nama}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">
              {user.nama.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
};

// --- APP ROUTING ---

const AppRoutes = () => {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        
        {/* Admin & Koordinator Routes */}
        {(user.role === Role.ADMIN || user.role === Role.KOORDINATOR) && (
          <>
            <Route path="/nasabah" element={<NasabahPage />} />
            <Route path="/transaksi" element={<TransaksiPage />} />
            <Route path="/pinjaman" element={<PinjamanPage />} />
          </>
        )}

        {/* Admin Only Route for Staff Management & Tutup Buku */}
        {user.role === Role.ADMIN && (
          <>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/tutup-buku" element={<TutupBukuPage />} />
          </>
        )}

        {/* Nasabah Routes */}
        {user.role === Role.NASABAH && (
          <>
            <Route path="/riwayat" element={<TransaksiPage />} />
            <Route path="/pinjaman-saya" element={<PinjamanPage />} />
            <Route path="/profil" element={<NasabahPage isPersonalProfile={true} />} />
          </>
        )}
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

const App = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;