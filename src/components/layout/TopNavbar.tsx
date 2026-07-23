import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell, LogOut, ChevronDown, User, Shield, GraduationCap, UserCheck, AlertCircle, CheckCircle2, Award, Info, RefreshCw } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_BADGE_STYLE } from '@/components/layout/AppSidebar';

export function TopNavbar() {
  const { address, role, disconnectWallet } = useWallet();
  const navigate = useNavigate();
  const { notifications, markAsRead, clearAll } = useNotifications();

  const unreadCount = notifications.filter(n => !n.read).length;
  const handleDisconnect = () => { disconnectWallet(); navigate('/'); };
  const roleInfo = role ? ROLE_BADGE_STYLE[role] : null;

  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Role Icons
  const RoleIcon = role === 'ADMIN' ? Shield : role === 'TEACHER' ? GraduationCap : role === 'STUDENT' ? UserCheck : User;

  return (
    <header style={{
      height: 56,
      background: '#FFFFFF',
      borderBottom: '1px solid #E4E7EC',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      {/* Sidebar toggle */}
      <SidebarTrigger style={{ color: '#6B7280', flexShrink: 0 }} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 6, border: '1px solid #E4E7EC',
            background: '#FFFFFF', cursor: 'pointer', color: '#6B7280',
          }}>
            <Bell style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 8, height: 8, background: '#DC2626',
                borderRadius: '50%', border: '2px solid #FFFFFF',
              }} />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" style={{ width: 320, padding: 0, borderRadius: 8, border: '1px solid #E4E7EC', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4E7EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Notifications</span>
            <button onClick={clearAll} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                No notifications
              </div>
            ) : notifications.map(n => {
              const itemRole = n.role || (role === 'ADMIN' ? 'ADMIN' : role === 'TEACHER' ? 'INSTRUCTOR' : 'STUDENT');
              
              const iconMap: any = {
                'ADMIN': Shield,
                'INSTRUCTOR': GraduationCap,
                'STUDENT': Award,
                'SYSTEM': RefreshCw
              };
              const Icon = iconMap[itemRole] || Info;

              const colorMap: any = {
                'ADMIN': '#6366F1',      // Indigo
                'INSTRUCTOR': '#8B5CF6', // Violet
                'STUDENT': '#10B981',    // Emerald
                'SYSTEM': '#6B7280'      // Gray
              };
              const themeColor = colorMap[itemRole] || '#6B7280';

              return (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E4E7EC',
                    cursor: 'pointer',
                    background: n.read ? '#FFFFFF' : `${themeColor}08`, // Very light transparent version
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="hover:bg-muted/50"
                >
                  {!n.read && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: 3, background: themeColor
                    }} />
                  )}

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: 6, 
                      background: `${themeColor}15`, color: themeColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ width: 14, height: 14 }} />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#4B5563', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Wallet / Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 4px 4px 12px', borderRadius: 8,
            border: '1px solid #E4E7EC', background: '#FFFFFF',
            cursor: 'pointer', fontSize: 13, color: '#374151',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }} className="hover:border-primary/30 hover:shadow-md group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  width: 8, height: 8, borderRadius: '50%', background: '#16A34A', 
                  position: 'absolute', bottom: -1, right: -1, border: '2px solid #FFFFFF' 
                }} />
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {address ? truncateAddr(address) : 'Not connected'}
                </span>
              </div>
              
              {roleInfo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: roleInfo.bg, color: roleInfo.color,
                  textTransform: 'uppercase', letterSpacing: '0.025em'
                }}>
                  <RoleIcon style={{ width: 10, height: 10 }} />
                  {roleInfo.label}
                </div>
              )}
            </div>
            
            <div style={{ 
              width: 32, height: 32, borderRadius: 6, 
              background: '#F9FAFB', border: '1px solid #E4E7EC',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ChevronDown style={{ width: 14, height: 14, color: '#9CA3AF' }} className="group-hover:text-foreground transition-colors" />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" style={{ width: 240, borderRadius: 8, border: '1px solid #E4E7EC', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: 4 }}>
          <div style={{ padding: '12px', marginBottom: 4, borderRadius: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Connected Wallet</p>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#111827', wordBreak: 'break-all', display: 'block' }}>{address}</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDisconnect}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 10, 
              padding: '10px 12px', fontSize: 14, color: '#DC2626', 
              cursor: 'pointer', fontWeight: 500, borderRadius: 4
            }}
            className="hover:bg-destructive/5"
          >
            <LogOut style={{ width: 16, height: 16 }} /> Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
