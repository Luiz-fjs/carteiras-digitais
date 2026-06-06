'use client';

import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (data: string) => void;
  active: boolean;
}

export function QRScanner({ onScan, active }: QRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let mounted = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!mounted || !containerRef.current) return;

      const scanner = new Html5Qrcode('qr-reader-container');
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {},
      ).catch((err: Error) => {
        setError(`Câmera: ${err.message}`);
      });
    });

    return () => {
      mounted = false;
      const scanner = scannerRef.current as { stop?: () => Promise<void> } | null;
      if (scanner?.stop) {
        scanner.stop().catch(() => {});
      }
    };
  }, [active, onScan]);

  return (
    <div className="w-full max-w-sm">
      <div
        id="qr-reader-container"
        ref={containerRef}
        className="rounded-2xl overflow-hidden border-2 border-accent/30"
      />
      {error && (
        <p className="text-red-400 text-xs text-center mt-2">{error}</p>
      )}
      <p className="text-zinc-500 text-xs text-center mt-3">
        Aponte a câmera para o QR Code da carteira digital
      </p>
    </div>
  );
}
