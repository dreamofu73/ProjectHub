import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColorClass?: string;
  iconBgClass?: string;
  to?: string;
  trend?: {
    value: string;
    isUp?: boolean;
  };
}

export const StatCard = ({ 
  label, 
  value, 
  icon: Icon, 
  iconColorClass = 'text-primary',
  iconBgClass = 'bg-primary-bg',
  to
}: StatCardProps) => {
  const content = (
    <>
      <div className={`stat-icon ${iconBgClass} ${iconColorClass} flex items-center justify-center rounded-2xl w-12 h-12 shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3`}>
        <Icon size={24} />
      </div>
      <div className="stat-content flex-1">
        <div className="stat-value text-2xl font-bold font-['Space_Grotesk'] tracking-tight text-gray-900 dark:text-white leading-none mb-1">{value}</div>
        <div className="stat-label text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card group relative overflow-hidden bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        {content}
      </Link>
    );
  }

  return (
    <div className="stat-card group relative overflow-hidden bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4">
      {content}
    </div>
  );
};
