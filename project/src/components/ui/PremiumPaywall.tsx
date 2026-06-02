import { Crown, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

interface PremiumPaywallProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function PremiumPaywall({ title, subtitle, children, footer }: PremiumPaywallProps) {
  return (
    <div className="relative rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-gray-900/90 to-gray-950 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative px-5 py-4 border-b border-amber-500/20 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90">
              Premium Feature
            </span>
          </div>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{subtitle}</p>}
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-medium text-amber-300">
          <Sparkles className="w-3 h-3" />
          Paywall Preview
        </span>
      </div>
      <div className="relative p-5">{children}</div>
      {footer && (
        <div className="relative px-5 py-3 border-t border-amber-500/15 bg-gray-950/50 text-[11px] text-gray-500">
          {footer}
        </div>
      )}
    </div>
  );
}
