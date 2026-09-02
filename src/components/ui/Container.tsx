import React, { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-[430px] min-h-screen shadow-xl relative ${className}`}>
      {children}
    </div>
  );
}
