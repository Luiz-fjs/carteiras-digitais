'use client';

export function VerifyingSpinner() {
  return (
    <div className="flex flex-col items-center gap-6 animate-fade-in">
      {/* Spinner com anel rotativo */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        {/* Ícone de escudo/verificação */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-10 h-10 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <p className="text-zinc-300 text-lg">Verificando credencial...</p>
        <p className="text-zinc-600 text-xs mt-1">Validando assinatura EdDSA + nonce + revogação</p>
      </div>
    </div>
  );
}
