'use client';

import { DEMO_SCENARIOS } from '@/lib/demo-scenarios';
import type { DemoScenario } from '@/lib/types';

interface ScannerViewProps {
  onScan: (scenario: DemoScenario) => void;
}

export function ScannerView({ onScan }: ScannerViewProps) {
  return (
    <div className="flex flex-col items-center gap-8 animate-fade-in">
      {/* Simulação visual do scanner */}
      <div className="relative w-72 h-72 rounded-2xl border-2 border-accent/40 bg-zinc-900/50 flex items-center justify-center overflow-hidden">
        {/* Linha de scan animada */}
        <div className="absolute left-4 right-4 h-0.5 bg-accent/60 animate-scan-line rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]" />

        {/* Cantos decorativos */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 288 288">
          {/* Canto superior esquerdo */}
          <path d="M 4 40 L 4 4 L 40 4" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          {/* Canto superior direito */}
          <path d="M 248 4 L 284 4 L 284 40" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          {/* Canto inferior esquerdo */}
          <path d="M 4 248 L 4 284 L 40 284" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          {/* Canto inferior direito */}
          <path d="M 248 284 L 284 284 L 284 248" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
        </svg>

        {/* Ícone central */}
        <div className="flex flex-col items-center gap-3 z-10">
          <svg className="w-16 h-16 text-accent/40 animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75H16.5v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75H16.5v-.75z" />
          </svg>
          <p className="text-zinc-500 text-sm">Aproxime o QR Code</p>
        </div>
      </div>

      {/* Painel de simulação */}
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600 uppercase tracking-widest">Modo Simulação</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DEMO_SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => onScan(scenario)}
              className={`
                px-3 py-2.5 rounded-lg text-xs font-medium transition-all
                border border-zinc-800 hover:border-zinc-600
                ${scenario.granted
                  ? 'bg-zinc-900 hover:bg-granted/10 text-zinc-300 hover:text-granted'
                  : 'bg-zinc-900 hover:bg-denied/10 text-zinc-300 hover:text-denied'
                }
              `}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
