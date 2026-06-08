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
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active || !containerRef.current || !started) return;

    let mounted = true;
    const scanStartTime = Date.now();

    const startScanner = async () => {
      try {
        const module = await import('html5-qrcode');
        const Html5Qrcode = module.Html5Qrcode ?? module.default?.Html5Qrcode;
        if (!Html5Qrcode) {
          throw new Error('Html5Qrcode não encontrado');
        }
        if (!mounted || !containerRef.current) return;

        const existing = scannerRef.current as { clear?: () => Promise<void> } | null;
        if (existing?.clear) {
          await existing.clear().catch(() => {});
        }

        const scanner = new Html5Qrcode('qr-reader-container', {
          verbose: false,
          formatsToSupport: [module.Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;
        setError('');

        const startWithConstraints = async (constraints?: MediaTrackConstraints) => {
          await scanner.start(
            constraints ?? { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 280, height: 280 },
              disableFlip: false,
            },
            (decodedText: string) => {
              if (!mounted) return;
              onScan(decodedText);
            },
            (errorMessage: string) => {
              if (!mounted) return;
              const isNoCodeFound =
                errorMessage.includes('NotFoundException') ||
                errorMessage.includes('No MultiFormat Readers');
              if (isNoCodeFound) {
                if (Date.now() - scanStartTime > 5000) {
                  setError('Aguardando QR válido... mantenha o código dentro da área.');
                }
                return;
              }
              setError(`Erro de leitura: ${errorMessage}`);
            },
          );
        };

        try {
          await startWithConstraints({ facingMode: { exact: 'environment' } });
        } catch (startError: any) {
          const fallbackMessage = String(startError || '');
          const isOverconstrained =
            fallbackMessage.includes('OverconstrainedError') ||
            fallbackMessage.includes('facingMode') ||
            fallbackMessage.includes('Constraint') ||
            fallbackMessage.includes('NotFoundError');
          if (isOverconstrained) {
            await startWithConstraints(undefined);
          } else {
            throw startError;
          }
        }
      } catch (err: any) {
        if (mounted) setError(`Câmera: ${err?.message ?? String(err)}`);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current as { clear?: () => Promise<void> } | null;
      if (scanner?.clear) {
        scanner.clear().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [active, onScan, started]);

  return (
    <div className="w-full max-w-sm">
      <div
        id="qr-reader-container"
        ref={containerRef}
        className="rounded-2xl overflow-hidden border-2 border-accent/30 min-h-[320px]"
      />

      <div className="mt-4 flex justify-center">
        {!started ? (
          <button
            onClick={() => {
              setError('');
              setStarted(true);
            }}
            disabled={!active}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
              active ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed'
            }`}
          >
            {active ? 'Iniciar leitura' : 'Leitura indisponível'}
          </button>
        ) : (
          <button
            onClick={() => {
              const scanner = scannerRef.current as { clear?: () => Promise<void> } | null;
              if (scanner?.clear) scanner.clear().catch(() => {});
              scannerRef.current = null;
              setStarted(false);
            }}
            className="px-4 py-2 rounded-lg font-medium text-sm transition bg-zinc-800 text-zinc-200"
          >
            Parar leitura
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center mt-2">{error}</p>
      )}
      <p className="text-zinc-500 text-xs text-center mt-3">
        Aponte a câmera para o QR Code da carteira digital
      </p>
    </div>
  );
}
