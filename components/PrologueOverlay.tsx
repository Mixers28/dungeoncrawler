'use client';

import { ArrowRight } from 'lucide-react';

export interface PrologueStep {
  image: string;
  text: string;
}

interface PrologueOverlayProps {
  steps: PrologueStep[];
  step: number;
  onAdvance: () => void;
  onFinish: () => void;
}

export function PrologueOverlay({ steps, step, onAdvance, onFinish }: PrologueOverlayProps) {
  const currentSlide = steps[step];
  const isLastStep = step >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000">
      <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="h-64 md:h-96 w-full relative">
          <img src={currentSlide.image} alt="Prologue" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
        </div>
        <div className="p-8 md:p-12 text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-serif text-amber-500 italic">Part {step + 1}</h2>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">{currentSlide.text}</p>
          <button
            onClick={isLastStep ? onFinish : onAdvance}
            className="bg-slate-800 hover:bg-amber-900 border border-slate-700 hover:border-amber-700 text-white px-8 py-3 rounded-full transition-all flex items-center gap-2 mx-auto"
          >
            {isLastStep ? 'Begin Adventure' : 'Next'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
