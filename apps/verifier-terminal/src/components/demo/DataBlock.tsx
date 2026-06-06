'use client';

interface DataBlockProps {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
  truncate?: boolean;
}

export function DataBlock({
  label,
  value,
  color = '#a1a1aa',
  mono = true,
  truncate = true,
}: DataBlockProps) {
  return (
    <div className="mb-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div
        className={`
          mt-0.5 text-xs px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800
          ${mono ? 'font-mono' : ''}
          ${truncate ? 'truncate' : 'break-all'}
        `}
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export function JWTBlock({ jwt, label }: { jwt: string; label: string }) {
  const parts = jwt.split('.');
  return (
    <div className="mb-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-0.5 text-[11px] font-mono px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 break-all leading-relaxed">
        <span className="text-red-400">{parts[0]}</span>
        <span className="text-zinc-600">.</span>
        <span className="text-purple-400">{parts[1]?.slice(0, 40)}...</span>
        <span className="text-zinc-600">.</span>
        <span className="text-cyan-400">{parts[2]?.slice(0, 30)}...</span>
      </div>
      <div className="flex gap-4 mt-1 text-[9px]">
        <span className="text-red-400/60">header</span>
        <span className="text-purple-400/60">payload</span>
        <span className="text-cyan-400/60">assinatura EdDSA</span>
      </div>
    </div>
  );
}
