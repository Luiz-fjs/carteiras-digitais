'use client';

import { useState } from 'react';

interface PasteInputProps {
  onSubmit: (data: string) => void;
}

export function PasteInput({ onSubmit }: PasteInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Cole o código primeiro');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.vpJWT || !parsed.roomId || !parsed.nonce) {
        setError('Código inválido — faltam campos (vpJWT, roomId, nonce)');
        return;
      }
    } catch {
      setError('Código não é um JSON válido');
      return;
    }
    setError('');
    onSubmit(trimmed);
    setValue('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      setError('');
    } catch {
      setError('Não consegui ler a área de transferência. Cole manualmente.');
    }
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <div>
        <label className="block text-xs text-zinc-400 mb-2">
          Cole o código gerado pela carteira:
        </label>
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder='{"vpJWT":"eyJ...","roomId":"...","nonce":"..."}'
          rows={6}
          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono resize-none focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePasteFromClipboard}
          className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition"
        >
          Colar da área de transferência
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-white font-semibold text-sm transition"
        >
          Verificar
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center">{error}</p>
      )}

      <p className="text-zinc-500 text-[10px] text-center">
        Cole o JSON do QR Code aqui — útil quando a câmera não funciona.
      </p>
    </div>
  );
}
