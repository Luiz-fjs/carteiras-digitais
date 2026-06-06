import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AccessChain — Carteira Digital',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-white antialiased">{children}</body>
    </html>
  );
}
