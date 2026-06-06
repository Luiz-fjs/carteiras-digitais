'use client';

interface AccessResultProps {
  granted: boolean;
  credentialType: string;
  holderName: string;
  reason?: string;
}

const CREDENTIAL_LABELS: Record<string, string> = {
  AlunoCredential: 'Aluno',
  CoordenacaoCredential: 'Coordenação',
  ColaboradorCredential: 'Colaborador',
  MembroCredential: 'Membro',
  VisitanteCredential: 'Visitante',
};

export function AccessResult({
  granted,
  credentialType,
  holderName,
  reason,
}: AccessResultProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-6
        w-full h-full rounded-3xl animate-fade-in
        ${granted ? 'bg-granted/5' : 'bg-denied/5'}
      `}
    >
      {/* Ícone principal com glow */}
      <div
        className={`
          w-36 h-36 rounded-full flex items-center justify-center
          animate-scale-in glow-border
          ${granted
            ? 'bg-granted/20 text-granted border-2 border-granted/50'
            : 'bg-denied/20 text-denied border-2 border-denied/50'
          }
        `}
      >
        {granted ? (
          <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {/* Texto principal */}
      <div className="text-center animate-slide-up">
        <h2
          className={`text-4xl font-bold tracking-wide ${
            granted ? 'text-granted' : 'text-denied'
          }`}
        >
          {granted ? 'ACESSO LIBERADO' : 'ACESSO NEGADO'}
        </h2>

        <div className="mt-4 space-y-1">
          <p className="text-xl text-zinc-200">{holderName}</p>
          <p className="text-sm text-zinc-500">
            {CREDENTIAL_LABELS[credentialType] ?? credentialType}
          </p>
        </div>

        {!granted && reason && (
          <div className="mt-4 px-6 py-3 rounded-xl bg-denied/10 border border-denied/20 max-w-md">
            <p className="text-sm text-denied/80">{reason}</p>
          </div>
        )}
      </div>

      {/* Barra de progresso de retorno */}
      <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden mt-4">
        <div
          className={`h-full rounded-full ${granted ? 'bg-granted' : 'bg-denied'}`}
          style={{
            animation: 'shrink 4s linear forwards',
          }}
        />
        <style>{`
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  );
}
