import { type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/lib_utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'primary' | 'secondary' | 'success' | 'warning';
  subtext?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, accent = 'primary', subtext, className }: StatCardProps) {
  return (
    <div className={cn(
      'bg-white border border-[#E4E7EC] rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginBottom: 8 }}>{title}</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{value}</p>
          {subtext && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{subtext}</p>}
        </div>
        <div className="stat-icon flex-shrink-0" style={{ width: 40, height: 40, background: '#F7F8FA', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 20, height: 20, color: '#6B7280' }} />
        </div>
      </div>
    </div>
  );
}
