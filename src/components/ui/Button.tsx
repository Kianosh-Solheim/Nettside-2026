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
    primary: 'bg-accent text-white hover:bg-accent/90 shadow-[0_0_20px_rgba(227,28,40,0.45),4px_4px_10px_var(--neu-shadow-dark-sm)] active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4)] active:scale-[0.98]',
    secondary: 'bg-surface text-ink neu-button active:scale-[0.98]',
    outline: 'bg-surface/90 text-ink neu-raised-sm hover:neu-button active:scale-[0.98] border border-ink/5',
    ghost: 'text-ink/70 hover:text-ink hover:bg-surface/60 hover:neu-raised-sm active:neu-inset-sm',
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
    <Link to={to} className={combinedClassName} role="button" {...(props as any)}>
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
