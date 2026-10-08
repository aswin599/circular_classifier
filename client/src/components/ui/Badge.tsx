import { ReactNode, ButtonHTMLAttributes } from 'react';

interface BadgeProps extends ButtonHTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  color?: string;
  size?: 'sm' | 'md';
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({ children, color = '#3B82F6', size = 'md', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeStyles[size]} ${className}`}
      style={{ backgroundColor: `${color}20`, color }}
      {...(props as object)}
    >
      {children}
    </span>
  );
}
