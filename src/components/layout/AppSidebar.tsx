import { useLocation, Link } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, BookOpen, Zap, Clock, Shield,
  FileText, ShieldCheck, Users, ScrollText, Activity, GraduationCap,
  UserCheck, Award,
} from 'lucide-react';
import { ENV } from '@/config/env';

const navItems = {
  STUDENT: [
    { title: 'My Exams', url: '/student/dashboard', icon: BookOpen },
    { title: 'My Results', url: '/student/results', icon: Award },
  ],
  TEACHER: [
    { title: 'Student Registry', url: '/instructor/dashboard?s=registry', icon: Users },
    { title: 'Exam Papers', url: '/instructor/dashboard?s=papers', icon: FileText },
    { title: 'Scheduler', url: '/instructor/dashboard?s=scheduler', icon: Clock },
    { title: 'Results', url: '/instructor/dashboard?s=results', icon: Award },
  ],
  ADMIN: [
    { title: 'Overview', url: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Users', url: '/admin/users', icon: Users },
    { title: 'Audit Logs', url: '/admin/audit', icon: ScrollText },
  ],
};

// Role color dots for topbar
export const ROLE_BADGE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN: { label: 'Admin', bg: '#EDE9FE', color: '#7C3AED' },
  TEACHER: { label: 'Instructor', bg: '#DBEAFE', color: '#1D4ED8' },
  STUDENT: { label: 'Student', bg: '#DCFCE7', color: '#15803D' },
};

export function AppSidebar() {
  const { role: walletRole } = useWallet();
  const location = useLocation();

  // Determine effective role from URL path in bypass mode
  let effectiveRole = walletRole;
  if (ENV.METAMASK_FLAG === 0 || ENV.TEACHER_FLAG === 0) {
    if (location.pathname.startsWith('/instructor')) effectiveRole = 'TEACHER';
    else if (location.pathname.startsWith('/admin')) effectiveRole = 'ADMIN';
    else if (location.pathname.startsWith('/student')) effectiveRole = 'STUDENT';
  }

  const items = effectiveRole ? (navItems[effectiveRole as keyof typeof navItems] || []) : [];
  const roleInfo = effectiveRole ? ROLE_BADGE_STYLE[effectiveRole] : null;

  return (
    <Sidebar style={{ background: '#FFFFFF', borderRight: '1px solid #E4E7EC', width: 240 }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #E4E7EC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap style={{ width: 20, height: 20, color: '#2563EB' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>ChainEdu</span>
        </div>
        {roleInfo && (
          <span style={{
            display: 'inline-flex', marginTop: 8, padding: '2px 8px',
            borderRadius: 4, fontSize: 12, fontWeight: 500,
            background: roleInfo.bg, color: roleInfo.color,
          }}>
            {roleInfo.label}
          </span>
        )}
      </div>

      <SidebarContent style={{ padding: '8px 0' }}>
        <SidebarGroup>
          <SidebarGroupLabel style={{
            fontSize: 11, fontWeight: 500, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '16px 16px 4px',
          }}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const itemPath = item.url.split('?')[0];
                const itemQuery = new URLSearchParams(item.url.split('?')[1] || '').get('s');
                const currentQuery = new URLSearchParams(location.search).get('s');

                const isActive = location.pathname === itemPath && (
                  (itemQuery && currentQuery === itemQuery) ||
                  (!currentQuery && itemQuery === 'registry') ||
                  (!itemQuery && !currentQuery)
                );

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.url}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: isActive ? 500 : 400,
                          color: isActive ? '#2563EB' : '#6B7280',
                          background: isActive ? '#EFF6FF' : 'transparent',
                          borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
                          textDecoration: 'none',
                          transition: 'background 100ms ease, color 100ms ease',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = '#F7F8FA';
                            (e.currentTarget as HTMLElement).style.color = '#111827';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = '#6B7280';
                          }
                        }}
                      >
                        <item.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
