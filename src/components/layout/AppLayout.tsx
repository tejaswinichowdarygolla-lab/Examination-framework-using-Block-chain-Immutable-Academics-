import { Outlet, Navigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { ENV } from '@/config/env';
import { Monitor } from 'lucide-react';

// Mobile notice component
function MobileNotice() {
  return (
    <div className="mobile-notice" style={{
      position: 'fixed', inset: 0, background: '#FFFFFF',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      zIndex: 9999,
    }}>
      <Monitor style={{ width: 40, height: 40, color: '#9CA3AF' }} />
      <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 300, margin: 0 }}>
        Please use a desktop browser to access this platform.
      </p>
    </div>
  );
}

export default function AppLayout() {
  const { isConnected, role } = useWallet();

  const shell = (
    <SidebarProvider>
      {/* Mobile notice */}
      <MobileNotice />

      <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', width: '100%', background: '#F7F8FA' }}>
        <AppSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopNavbar />
          <main style={{ flex: 1, padding: 32, overflowY: 'auto', background: '#F7F8FA' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  // Bypass all checks in dev mode
  if (ENV.METAMASK_FLAG === 0) return shell;

  if (!isConnected) return <Navigate to="/" replace />;

  if (role === null) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '2px solid #2563EB', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 14, color: '#6B7280' }}>Establishing session...</p>
        </div>
      </div>
    );
  }

  return shell;
}
