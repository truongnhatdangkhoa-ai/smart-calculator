import type { ReactNode } from 'react';

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}
type P = { className?: string };
export const IconCalc = ({ className }: P) => (
  <Svg className={className}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" /><rect x="8" y="6" width="8" height="3" rx="0.5" />
    {[[9, 13], [12, 13], [15, 13], [9, 17], [12, 17], [15, 17]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />)}
  </Svg>
);
export const IconFormula = ({ className }: P) => <Svg className={className}><path d="M17.5 5H7.5l5 7-5 7h10" /></Svg>;
export const IconGraph = ({ className }: P) => <Svg className={className}><path d="M4 4v16h16" /><path d="M7 16c2.5-9 5.5 1 10-9" /></Svg>;
export const IconHistory = ({ className }: P) => <Svg className={className}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconSettings = ({ className }: P) => (
  <Svg className={className}><path d="M5 8h14M5 16h14" /><circle cx="9" cy="8" r="2" fill="var(--bar-bg, transparent)" /><circle cx="15" cy="16" r="2" fill="var(--bar-bg, transparent)" /></Svg>
);
export const IconBack = ({ className }: P) => <Svg className={className}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconUndo = ({ className }: P) => <Svg className={className}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></Svg>;
export const IconCopy = ({ className }: P) => <Svg className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></Svg>;
export const IconCheck = ({ className }: P) => <Svg className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconCross = ({ className }: P) => <Svg className={className}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconChevron = ({ className }: P) => <Svg className={className}><path d="M7 10l5 5 5-5" /></Svg>;
