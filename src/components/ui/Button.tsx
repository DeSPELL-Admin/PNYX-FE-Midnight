import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

// href 가 있으면 anchor(Link), 없으면 button 으로 렌더한다.
// 소비처가 React.ComponentProps<typeof Button> 로 props 를 파생/스프레드하기 쉽도록
// 평면(flat) 타입을 유지한다 (판별 유니온은 스프레드 시 핸들러 타입 충돌을 일으켰다).
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'ctaYellow' | 'ctaBlack';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
  href?: string;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className = '',
  children,
  href,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-[15px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50 focus:ring-gray-500",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
    ctaYellow: "bg-gradient-to-r from-point-yellow to-[#ECEAE7] text-black",
    ctaBlack: "bg-primary text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-6 py-2 text-[16px] font-[600]",
    lg: "px-6 py-3 text-base",
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  if (href !== undefined) {
    // button 전용 attr 가 섞일 수 있어 anchor 스프레드는 캐스팅한다.
    return (
      <Link href={href} className={classes} {...(props as unknown as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}
