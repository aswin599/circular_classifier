import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-brand-100 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
