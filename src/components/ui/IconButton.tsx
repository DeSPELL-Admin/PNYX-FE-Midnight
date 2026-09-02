import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'subtle';
type IconButtonSize = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  'aria-label': string;
  children: ReactNode;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'text-white hover:bg-white/10 hover:text-point-yellow',
  subtle: 'text-gray-400 hover:bg-white/10 hover:text-white',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'p-1',
  md: 'p-2',
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', className = '', children, ...props }, ref) => {
    const classes = `inline-flex items-center justify-center rounded-full transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';

export default IconButton;
