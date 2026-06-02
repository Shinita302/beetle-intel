interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-600/30',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-400 border-transparent',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}
