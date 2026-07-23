import { cn } from '@/utils/lib_utils';
import type { Role } from '@/context/WalletContext';

// ── Role Badges ──────────────────────────────────────────────────────────────

const roleBadgeConfig: Record<string, { label: string; className: string }> = {
  STUDENT:    { label: 'Student',    className: 'bg-[#DCFCE7] text-[#15803D]' },
  TEACHER:    { label: 'Instructor', className: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  ADMIN:      { label: 'Admin',      className: 'bg-[#EDE9FE] text-[#7C3AED]' },
  instructor: { label: 'Instructor', className: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  student:    { label: 'Student',    className: 'bg-[#DCFCE7] text-[#15803D]' },
  admin:      { label: 'Admin',      className: 'bg-[#EDE9FE] text-[#7C3AED]' },
  NONE:       { label: 'None',       className: 'bg-[#F3F4F6] text-[#6B7280]' },
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const config = roleBadgeConfig[role as string] || { label: role, className: 'bg-[#F3F4F6] text-[#6B7280]' };
  return (
    <span className={cn(
      'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}

// ── Status Badges ─────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[#DCFCE7] text-[#14532D]',
  warning: 'bg-[#FEF3C7] text-[#92400E]',
  error:   'bg-[#FEE2E2] text-[#7F1D1D]',
  info:    'bg-[#DBEAFE] text-[#1E3A8A]',
  default: 'bg-[#F3F4F6] text-[#374151]',
};

export function StatusBadge({ children, variant = 'default', pulse, className }: {
  children: React.ReactNode; variant?: BadgeVariant; pulse?: boolean; className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
      variantStyles[variant],
      className
    )}>
      {pulse && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', {
        'bg-[#14532D]': variant === 'success',
        'bg-[#92400E]': variant === 'warning',
        'bg-[#7F1D1D]': variant === 'error',
        'bg-[#1E3A8A]': variant === 'info',
      })} />}
      {children}
    </span>
  );
}
