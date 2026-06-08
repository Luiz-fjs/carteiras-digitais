'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createVP, type KeyPair } from '@/lib/crypto-browser';
import QRCode from 'qrcode';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function ApresentarContent() {
  const searchParams = useSearchParams();
  const credId = searchParams.get('credId');

  const [keys, setKeys] = useState<KeyPair | null>(null);
  const [credential, setCredential] = useState<{ jwt: string; credentialType: string } | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [nonce, setNonce] = useState('');
  const [vpJWT, setVpJWT] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'generating' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(300);

  // Carrega chaves
  useEffect(() => {
    const stored = localStorage.getItem('accesschain_keys');
    if (stored) {
      const parsed = JSON.parse(stored);
      setKeys({
        did: parsed.did,
        publicKey: Uint8Array.from(parsed.publicKey),
        privateKey: Uint8Array.from(parsed.privateKey),
      });
    }
  }, []);

  // Busca credencial e salas
  useEffect(() => {
    if (!credId) return;
    fetch(`${API}/credentials/${credId}`)
      .then(r => r.json())
      .then(data => {
        setCredential({ jwt: data.jwt, credentialType: data.credentialType });
        setStatus('ready');
      })
      .catch(() => { setError('Erro ao buscar credencial'); setStatus('error'); });

    // Busca todas as salas (via issuers de tipo association)
    fetch(`${API}/issuers`)
      .then(r => r.json())
      .then(async (issuers: { id: string; type: string }[]) => {
        const allRooms: { id: string; name: string }[] = [];
        for (const iss of issuers.filter(i => i.type === 'association')) {
          const res = await fetch(`${API}/issuers/${iss.id}/rooms`);
          const r = await res.json();
          allRooms.push(...r);
        }
        setRooms(allRooms);
        if (allRooms.length > 0) setSelectedRoom(allRooms[0].id);
      })
      .catch(() => {});
  }, [credId]);

  // Countdown do QR
  useEffect(() => {
    if (status !== 'done') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('ready');
          setQrDataUrl('');
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const generateQR = useCallback(async () => {
    if (!keys || !credential || !selectedRoom) return;
    setStatus('generating');
    setError('');

    try {
      // 1. Buscar nonce do terminal
      const nonceRes = await fetch(`${API}/presentations/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoom }),
      });
      const { nonce: serverNonce } = await nonceRes.json();
      setNonce(serverNonce);

      // 2. Criar VP assinada no browser
      const vp = await createVP({
        holderDID: keys.did,
        holderPrivateKey: keys.privateKey,
        vcJWTs: [credential.jwt],
        nonce: serverNonce,
        expiresInSeconds: 300,
      });
      setVpJWT(vp);

      // 3. Gerar QR Code contendo o payload para verificação
      const qrPayload = JSON.stringify({
        vpJWT: vp,
        roomId: selectedRoom,
        nonce: serverNonce,
      });
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'L',
      });
      setQrDataUrl(dataUrl);
      setCountdown(300);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar QR Code');
      setStatus('error');
    }
  }, [keys, credential, selectedRoom]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-zinc-500 hover:text-white transition">← Voltar</Link>
        <h1 className="text-lg font-bold">
          Apresentar <span className="text-cyan-400">Credencial</span>
        </h1>
      </header>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Seleção de sala */}
        {rooms.length > 0 && status !== 'done' && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Em qual sala você quer entrar?</label>
            <select
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm"
            >
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        {/* Botão gerar */}
        {status === 'ready' && (
          <button
            onClick={generateQR}
            className="w-full py-4 rounded-xl bg-accent hover:bg-accent/80 text-white font-semibold transition text-sm"
          >
            Gerar QR Code para acesso
          </button>
        )}

        {/* Loading */}
        {status === 'generating' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-500 text-sm mt-3">Assinando VP e gerando QR Code...</p>
          </div>
        )}

        {/* QR Code */}
        {status === 'done' && qrDataUrl && (
          <div className="text-center space-y-4">
            <div className="inline-block p-4 rounded-2xl border-2 border-accent/30 bg-zinc-900">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
            </div>

            <div>
              <p className="text-zinc-300 text-sm">Aponte para a câmera do terminal</p>
              <p className={`text-lg font-mono font-bold mt-1 ${countdown < 60 ? 'text-red-400' : 'text-cyan-400'}`}>
                Expira em {formatTime(countdown)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / 300) * 100}%` }}
              />
            </div>

            <div className="text-[10px] text-zinc-600 space-y-1">
              <p>Nonce: <span className="font-mono text-zinc-500">{nonce}</span></p>
              <p>VP-JWT: <span className="font-mono text-zinc-500">{vpJWT.slice(0, 40)}...</span></p>
            </div>

            <button
              onClick={generateQR}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
            >
              Gerar novo QR Code
            </button>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApresentarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-500">Carregando...</div>}>
      <ApresentarContent />
    </Suspense>
  );
}
