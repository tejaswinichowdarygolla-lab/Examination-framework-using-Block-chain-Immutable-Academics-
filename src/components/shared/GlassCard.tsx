import { type ReactNode } from 'react';
import { cn } from '@/utils/lib_utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-[#E4E7EC] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        hover && 'cursor-pointer transition-colors hover:border-[#D1D5DB]',
        'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
