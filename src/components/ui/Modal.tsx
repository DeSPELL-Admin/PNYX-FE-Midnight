"use client";

import { useEffect, useRef, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: 'default' | 'fullscreen';
}

export default function Modal({ isOpen, onClose, children, variant = 'default' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
      // 열릴 때 모달로 포커스 이동 (기본 접근성)
      modalRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fullscreenClasses = "w-full h-full mx-auto max-w-[430px]";
  const defaultClasses = "bg-brand-primary-700/60 border border-brand-primary-600/30 text-white rounded-2xl w-full max-w-[330px] backdrop-blur-[45px] shadow-[0_0_11px_0_rgba(0,0,0,0.10)]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 bg-[#19191980] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`${variant === 'fullscreen' ? fullscreenClasses : defaultClasses} transform transition-all animate-in zoom-in-95 duration-200 focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${variant === 'fullscreen' ? 'h-full' : 'p-4 max-h-[70vh]'} overflow-y-auto`}>
          {children}
        </div>
      </div>
    </div>
  );
}
