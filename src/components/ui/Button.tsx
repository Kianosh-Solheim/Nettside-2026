import { motion } from 'framer-motion';
import Magnetic from '../Magnetic';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  className?: string;
  magnetic?: boolean;
  to?: string;
}

export default function Button({
  children,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  magnetic = true,
  to,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-paper hover:bg-accent/90 shadow-lg shadow-accent/20',
    secondary: 'bg-ink/5 text-ink hover:bg-ink/10',
    outline: 'border border-ink/20 text-ink hover:bg-ink/5',
    ghost: 'text-ink/60 hover:text-ink hover:bg-ink/5',
  };

  const sizes = {
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-6 py-3 text-[12px]',
    lg: 'px-10 py-4 text-[14px]',
  };

  const baseStyles = 'inline-flex items-center justify-center space-x-2 rounded-full uppercase tracking-widest font-bold transition-all disabled:opacity-50';
  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  const content = (
    <>
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="flex items-center justify-center"
        >
          {Icon ? <Icon size={size === 'sm' ? 16 : 18} /> : <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        </motion.div>
      ) : (
        <>
          {children && <span>{children}</span>}
          {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
        </>
      )}
    </>
  );

  const buttonElement = to ? (
    <Link to={to} className={combinedClassName}>
      {content}
    </Link>
  ) : (
    <button
      className={combinedClassName}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {content}
    </button>
  );

  if (magnetic && !className.includes('absolute') && !className.includes('fixed')) {
    return <Magnetic>{buttonElement}</Magnetic>;
  }

  return buttonElement;
}
