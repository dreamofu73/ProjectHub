import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ 
  title, 
  description, 
  actions,
  breadcrumb,
  className = ''
}: PageHeaderProps) => (
  <div className={`page-header ${className}`.trim()}>
    <div className="page-header-content">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>
);
