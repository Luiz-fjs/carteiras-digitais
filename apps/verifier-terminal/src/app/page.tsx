'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock } from '@/components/Clock';
import { ScannerView } from '@/components/ScannerView';
import { QRScanner } from '@/components/QRScanner';
import { PasteInput } from '@/components/PasteInput';
import { VerifyingSpinner } from '@/components/VerifyingSpinner';
import { AccessResult } from '@/components/AccessResult';
import { AccessLog } from '@/components/AccessLog';
import type { TerminalState, AccessLogEntry, DemoScenario } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const RESULT_DISPLAY_MS = 4000;

interface Room {
  id: string;
  name: string;
}

export default function TerminalPage() {
  const [state, setState] = useState<TerminalState>('scanning');
  const [currentResult, setCurrentResult] = useState<{ granted: boolean; type: string; holderName: string; reason?: string } | null>(null);
  const [logEntries, setLogEntries] = useState<AccessLogEntry[]>([]);
  const [mode, setMode] = useState<'camera' | 'paste' | 'simulation'>('camera');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Busca salas da API
  useEffect(() => {
    fetch(`${API}/issuers`)
      .then(r => r.json())
      .then(async (issuers: { id: string; type: string; name: string }[]) => {
        const allRooms: Room[] = [];
        for (const iss of issuers.filter(i => i.type === 'association')) {
          const res = await fetch(`${API}/issuers/${iss.id}/rooms`);
          const r = await res.json();
          allRooms.push(...r);
        }
        setRooms(allRooms);
        if (allRooms.length > 0) setSelectedRoom(allRooms[0]);
      })
      .catch(() => {});
  }, []);

  const showResult = useCallback((result: { granted: boolean; type: string; holderName: string; reason?: string }) => {
    setState(result.granted ? 'granted' : 'denied');
    setCurrentResult(result);

    const entry: AccessLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      granted: result.granted,
      credentialType: result.type,
      holderName: result.holderName,
      reason: result.reason,
    };
    setLogEntries(prev => [entry, ...prev]);

    setTimeout(() => {
      setState('scanning');
      setCurrentResult(null);
    }, RESULT_DISPLAY_MS);
  }, []);

  // Handler para QR Code real (câmera)
  const handleQRScan = useCallback(async (data: string) => {
    if (state !== 'scanning') return;
    setState('verifying');

    try {
      const parsed = JSON.parse(data);
      // SEGURANÇA: o roomId enviado pra API é o da sala ONDE este terminal está,
      // não o que veio dentro do QR. Senão um QR gerado pra sala X funcionaria
      // em qualquer terminal de outra sala.
      const terminalRoomId = selectedRoom?.id ?? parsed.roomId;
      const res = await fetch(`${API}/presentations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vpJWT: parsed.vpJWT,
          roomId: terminalRoomId,
          nonce: parsed.nonce,
        }),
      });
      const result = await res.json();

      // Prioriza o nome (vem do credentialSubject.nome da VC).
      // Cai pro DID truncado se a credencial não tiver nome (ex: erro antes da verificação da VC).
      const displayName =
        result.holderName && result.holderName.trim().length > 0
          ? result.holderName
          : result.holderDid
            ? `${result.holderDid.slice(0, 20)}...`
            : 'Desconhecido';

      showResult({
        granted: result.granted,
        type: result.credentialType ?? 'unknown',
        holderName: displayName,
        reason: result.reason,
      });
    } catch {
      showResult({
        granted: false,
        type: 'unknown',
        holderName: 'Erro',
        reason: 'QR Code inválido ou erro de comunicação com a API',
      });
    }
  }, [state, showResult, selectedRoom]);

  // Handler para modo simulação
  const handleSimScan = useCallback((scenario: DemoScenario) => {
    setState('verifying');
    setTimeout(() => {
      showResult({
        granted: scenario.granted,
        type: scenario.type,
        holderName: scenario.holderName,
        reason: scenario.reason,
      });
    }, 1500);
  }, [showResult]);

  const roomName = selectedRoom?.name ?? 'Terminal AccessChain';

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Área principal */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
            {rooms.length > 1 ? (
              <select
                value={selectedRoom?.id ?? ''}
                onChange={e => setSelectedRoom(rooms.find(r => r.id === e.target.value) ?? null)}
                className="text-lg font-semibold text-zinc-100 bg-transparent border-none outline-none cursor-pointer"
              >
                {rooms.map(r => <option key={r.id} value={r.id} className="bg-zinc-900">{r.name}</option>)}
              </select>
            ) : (
              <h1 className="text-lg font-semibold text-zinc-100 tracking-wide">{roomName}</h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle câmera / simulação */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              <button
                onClick={() => setMode('camera')}
                className={`px-3 py-1 text-[10px] font-medium transition ${
                  mode === 'camera' ? 'bg-accent text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Câmera
              </button>
              <button
                onClick={() => setMode('paste')}
                className={`px-3 py-1 text-[10px] font-medium transition ${
                  mode === 'paste' ? 'bg-cyan-500 text-black' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Colar
              </button>
              <button
                onClick={() => setMode('simulation')}
                className={`px-3 py-1 text-[10px] font-medium transition ${
                  mode === 'simulation' ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Simulação
              </button>
            </div>
            <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-1 rounded">v1.0</span>
            <Clock />
          </div>
        </header>

        {/* Conteúdo central */}
        <main className="flex-1 flex items-center justify-center p-8">
          {state === 'scanning' && mode === 'camera' && (
            <QRScanner onScan={handleQRScan} active={state === 'scanning'} />
          )}

          {state === 'scanning' && mode === 'paste' && (
            <PasteInput onSubmit={handleQRScan} />
          )}

          {state === 'scanning' && mode === 'simulation' && (
            <ScannerView onScan={handleSimScan} />
          )}

          {state === 'verifying' && <VerifyingSpinner />}

          {(state === 'granted' || state === 'denied') && currentResult && (
            <AccessResult
              granted={currentResult.granted}
              credentialType={currentResult.type}
              holderName={currentResult.holderName}
              reason={currentResult.reason}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="px-8 py-3 border-t border-zinc-800/50 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${mode === 'camera' ? 'bg-granted' : 'bg-zinc-600'}`} />
            <span className="text-[10px] text-zinc-600">{mode === 'camera' ? 'Câmera ativa' : 'Câmera desligada'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[10px] text-zinc-600">API conectada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${mode === 'simulation' ? 'bg-yellow-500' : 'bg-zinc-600'}`} />
            <span className="text-[10px] text-zinc-600">{mode === 'simulation' ? 'Modo simulação' : ''}</span>
          </div>
        </footer>
      </div>

      {/* Sidebar */}
      <aside className="w-80 border-l border-zinc-800/50 bg-zinc-950">
        <AccessLog entries={logEntries} />
      </aside>
    </div>
  );
}
