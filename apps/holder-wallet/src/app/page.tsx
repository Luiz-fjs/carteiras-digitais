'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateDIDKey, bytesToHex, type KeyPair } from '@/lib/crypto-browser';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface StoredCredential {
  id: string;
  credentialType: string;
  issuerDid: string;
  jwt: string;
  claims: Record<string, unknown>;
  status: string;
  issuedAt: string;
  issuer?: { name: string };
}

const TYPE_LABELS: Record<string, string> = {
  AlunoCredential: 'Aluno',
  CoordenacaoCredential: 'Coordenação',
  ColaboradorCredential: 'Colaborador',
  MembroCredential: 'Membro',
  VisitanteCredential: 'Visitante',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  revoked: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  used: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export default function WalletPage() {
  const [keys, setKeys] = useState<KeyPair | null>(null);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Carrega ou gera chaves do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('accesschain_keys');
    if (stored) {
      const parsed = JSON.parse(stored);
      setKeys({
        did: parsed.did,
        publicKey: Uint8Array.from(parsed.publicKey),
        privateKey: Uint8Array.from(parsed.privateKey),
      });
      setLoading(false);
    } else {
      generateDIDKey().then(kp => {
        localStorage.setItem('accesschain_keys', JSON.stringify({
          did: kp.did,
          publicKey: Array.from(kp.publicKey),
          privateKey: Array.from(kp.privateKey),
        }));
        setKeys(kp);
        setLoading(false);
      });
    }
  }, []);

  // Busca credenciais da API quando tem DID
  const fetchCredentials = useCallback(async () => {
    if (!keys) return;
    try {
      const res = await fetch(`${API}/credentials/holder/${encodeURIComponent(keys.did)}`);
      if (res.ok) setCredentials(await res.json());
    } catch { /* API offline */ }
  }, [keys]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const copyDID = () => {
    if (keys) {
      navigator.clipboard.writeText(keys.did);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm mt-3">Gerando identidade digital...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          AccessChain <span className="text-cyan-400">— Carteira Digital</span>
        </h1>
        <button
          onClick={fetchCredentials}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition"
        >
          Atualizar
        </button>
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Identidade */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Sua Identidade Digital</h2>
              <p className="text-[10px] text-zinc-500">Chaves Ed25519 armazenadas no browser</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Seu DID</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-cyan-300 truncate">
                {keys?.did}
              </code>
              <button
                onClick={copyDID}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/20 border border-red-900/20">
            <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-[10px] text-red-300">Chave privada armazenada apenas neste browser</span>
          </div>
        </div>

        {/* Credenciais */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            Minhas Credenciais ({credentials.length})
          </h2>

          {credentials.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center">
              <p className="text-zinc-600 text-sm">Nenhuma credencial ainda</p>
              <p className="text-zinc-700 text-xs mt-1">
                Copie seu DID acima e peça a um Issuer para emitir uma credencial
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map(cred => (
                <div key={cred.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">
                      {TYPE_LABELS[cred.credentialType] ?? cred.credentialType}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[cred.status] ?? ''}`}>
                      {cred.status}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Emitido por <span className="text-zinc-300">{cred.issuer?.name ?? '?'}</span>
                    {' · '}
                    {new Date(cred.issuedAt).toLocaleDateString('pt-BR')}
                  </div>

                  {cred.claims && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(cred.claims as Record<string, unknown>)
                        .filter(([k]) => !['roomId', 'associationId', 'allowedDay', 'startHour', 'endHour'].includes(k))
                        .map(([k, v]) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {k}: {String(v)}
                          </span>
                        ))}
                    </div>
                  )}

                  {cred.status === 'active' && (
                    <Link
                      href={`/apresentar?credId=${cred.id}`}
                      className="block mt-2 text-center py-2 rounded-lg bg-accent hover:bg-accent/80 text-white text-xs font-medium transition"
                    >
                      Apresentar na porta (gerar QR Code)
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
