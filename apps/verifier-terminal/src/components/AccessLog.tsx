'use client';

import type { AccessLogEntry } from '@/lib/types';

const CREDENTIAL_LABELS: Record<string, string> = {
  AlunoCredential: 'Aluno',
  CoordenacaoCredential: 'Coord.',
  ColaboradorCredential: 'Colab.',
  MembroCredential: 'Membro',
  VisitanteCredential: 'Visitante',
};

interface AccessLogProps {
  entries: AccessLogEntry[];
}

export function AccessLog({ entries }: AccessLogProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Log de Acessos
        </h3>
        <span className="ml-auto text-xs text-zinc-600">{entries.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto log-scroll">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-700 text-xs">Nenhum acesso registrado</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 animate-slide-up hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {/* Indicador de status */}
                  <div
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.granted ? 'bg-granted' : 'bg-denied'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-200 truncate">
                        {entry.holderName}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          entry.granted
                            ? 'bg-granted/10 text-granted'
                            : 'bg-denied/10 text-denied'
                        }`}
                      >
                        {CREDENTIAL_LABELS[entry.credentialType] ?? entry.credentialType}
                      </span>
                    </div>

                    {!entry.granted && entry.reason && (
                      <p className="text-[11px] text-denied/60 mt-0.5 truncate">
                        {entry.reason}
                      </p>
                    )}

                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {entry.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
