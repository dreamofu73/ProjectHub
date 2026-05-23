import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge = ({ 
  children, 
  variant = 'default', 
  className = '',
  icon
}: BadgeProps) => {
  const baseClass = variant.startsWith('badge-') ? variant : `badge-${variant}`;
  
  return (
    <span className={`badge ${baseClass} ${className}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
};
