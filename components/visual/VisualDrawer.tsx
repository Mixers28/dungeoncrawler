'use client';

import { X } from 'lucide-react';

interface VisualDrawerProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function VisualDrawer({ title, isOpen, onClose, children }: VisualDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-amber-500">{title}</h2>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
