import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => (
  <div className={`card ${className}`}>{children}</div>
);

export const CardHeader = ({ 
  children, 
  title, 
  action, 
  className = '' 
}: { 
  children?: React.ReactNode; 
  title?: string; 
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={`card-header ${className}`}>
    {title ? <h2 className="card-title">{title}</h2> : children}
    {action && <div className="card-actions">{action}</div>}
  </div>
);

export const CardBody = ({ 
  children, 
  className = '',
  noPadding = false
}: { 
  children: React.ReactNode; 
  className?: string;
  noPadding?: boolean;
}) => (
  <div className={`card-body ${className}`} style={noPadding ? { padding: 0 } : undefined}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`card-footer ${className}`}>{children}</div>
);
