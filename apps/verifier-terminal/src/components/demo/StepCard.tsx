'use client';

interface StepCardProps {
  step: number;
  title: string;
  actor: string;
  actorColor: string;
  active: boolean;
  completed: boolean;
  children: React.ReactNode;
}

export function StepCard({
  step,
  title,
  actor,
  actorColor,
  active,
  completed,
  children,
}: StepCardProps) {
  return (
    <div
      className={`
        rounded-2xl border transition-all duration-500
        ${active
          ? 'border-accent/50 bg-zinc-900/80 shadow-lg shadow-accent/5'
          : completed
            ? 'border-zinc-800 bg-zinc-900/40 opacity-70'
            : 'border-zinc-800/50 bg-zinc-950/50 opacity-40'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50">
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            ${active
              ? 'bg-accent text-white'
              : completed
                ? 'bg-green-600 text-white'
                : 'bg-zinc-800 text-zinc-500'
            }
          `}
        >
          {completed ? '✓' : step}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
          style={{ color: actorColor, backgroundColor: `${actorColor}15` }}
        >
          {actor}
        </span>
      </div>

      {/* Body */}
      {(active || completed) && (
        <div className="px-5 py-4">{children}</div>
      )}
    </div>
  );
}
