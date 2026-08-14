'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  side: 'left' | 'right';
  onClose: () => void;
  label: string;
  children: ReactNode;
}

/** Narrow-viewport slide-over holding one of the desktop sidebars. */
export function MobileSidebarDrawer({ isOpen, side, onClose, label, children }: MobileSidebarDrawerProps) {
  if (!isOpen) return null;

  const isLeft = side === 'left';
  return (
    <div className={`fixed inset-0 z-50 md:hidden flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative w-[85%] max-w-[350px] h-full bg-slate-950 shadow-2xl ${
          isLeft
            ? 'border-r border-slate-800 animate-in slide-in-from-left duration-300'
            : 'border-l border-slate-800 animate-in slide-in-from-right duration-300'
        }`}
      >
        <button
          onClick={onClose}
          aria-label={`Close ${label}`}
          className="absolute top-4 right-4 z-50 bg-slate-900 p-2 rounded-full text-slate-300 border border-slate-700"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
