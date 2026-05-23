import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, fullWidth = false, rightElement, className = '', ...props }, ref) => {
    const containerClasses = `${fullWidth ? 'w-full' : ''} ${className}`.trim();
    
    return (
      <div className={containerClasses}>
        {label && (
          <label className="form-label flex items-center gap-1">
            {label}
            {props.required && <span className="text-danger font-bold">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Icon size={16} />
            </div>
          )}
          <input
            ref={ref}
            className={`form-control ${Icon ? 'has-icon' : ''} ${error ? 'error' : ''} ${rightElement ? '!pr-12' : ''}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
  fullWidth?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, fullWidth = false, className = '', ...props }, ref) => {
    const containerClasses = `${fullWidth ? 'w-full' : ''} ${className}`.trim();

    return (
      <div className={containerClasses}>
        {label && (
          <label className="form-label flex items-center gap-1">
            {label}
            {props.required && <span className="text-danger font-bold">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`form-control ${error ? 'error' : ''}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
