import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'info' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    icon: Icon, 
    iconPosition = 'left', 
    isLoading, 
    fullWidth = false,
    children, 
    disabled,
    ...props 
  }, ref) => {
    
    const baseStyles = "btn";
    
    const variantStyles = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      danger: "btn-danger",
      success: "btn-success",
      ghost: "btn-ghost",
      outline: "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700",
      info: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
      warning: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm",
    };

    const sizeStyles = {
      sm: "btn-sm",
      md: "", // default btn padding
      lg: "btn-lg",
      icon: "btn-icon",
    };

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim();

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading && (
          <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'currentColor' }} />
        )}
        {!isLoading && Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 16} />}
        {children}
        {!isLoading && Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 16} />}
      </button>
    );
  }
);

Button.displayName = 'Button';
