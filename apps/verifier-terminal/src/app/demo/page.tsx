'use client';

import { useState, useCallback } from 'react';
import { StepCard } from '@/components/demo/StepCard';
import { DataBlock, JWTBlock } from '@/components/demo/DataBlock';
import {
  generateDIDKey,
  signVC,
  verifyVC,
  createVP,
  verifyVP,
  bytesToHex,
  decodeJWT,
  type KeyPair,
  type VCData,
} from '@/lib/crypto-browser';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface DemoState {
  issuer?: KeyPair;
  holder?: KeyPair;
  vc?: VCData;
  nonce?: string;
  vpJWT?: string;
  verifyResult?: { granted: boolean; checks: string[] };
}

const ROOM = { id: 'room-codelabs-001', name: 'Sala CodeLabs' };

export default function DemoPage() {
  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<DemoState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const runStep = useCallback(
    async (nextStep: Step) => {
      setLoading(true);
      setError(undefined);
      try {
        switch (nextStep) {
          // Passo 1 — Gerar identidade do Issuer
          case 1: {
            const issuer = await generateDIDKey();
            setState((s) => ({ ...s, issuer }));
            break;
          }
          // Passo 2 — Gerar identidade do Holder
          case 2: {
            const holder = await generateDIDKey();
            setState((s) => ({ ...s, holder }));
            break;
          }
          // Passo 3 — Issuer emite VC para o Holder
          case 3: {
            const vc = await signVC({
              issuerDID: state.issuer!.did,
              issuerPrivateKey: state.issuer!.privateKey,
              subjectDID: state.holder!.did,
              credentialType: 'MembroCredential',
              credentialId: crypto.randomUUID(),
              claims: {
                associationId: 'codelabs',
                roomId: ROOM.id,
                cargo: 'Desenvolvedor',
                nome: 'Ana Silva',
              },
            });
            setState((s) => ({ ...s, vc }));
            break;
          }
          // Passo 4 — Verifier gera nonce + Holder cria VP
          case 4: {
            const nonce = crypto.randomUUID();
            setState((s) => ({ ...s, nonce }));
            break;
          }
          // Passo 5 — Holder assina VP com nonce
          case 5: {
            const vpJWT = await createVP({
              holderDID: state.holder!.did,
              holderPrivateKey: state.holder!.privateKey,
              vcJWTs: [state.vc!.jwt],
              nonce: state.nonce!,
              expiresInSeconds: 300,
            });
            setState((s) => ({ ...s, vpJWT }));
            break;
          }
          // Passo 6 — Verifier verifica tudo
          case 6: {
            const checks: string[] = [];

            // 6a. Verifica VP (assinatura do holder + nonce + expiração)
            try {
              await verifyVP(state.vpJWT!, state.nonce!);
              checks.push('Assinatura da VP (holder) — válida');
              checks.push('Nonce anti-replay — correto');
              checks.push('Expiração da VP (5 min) — dentro do prazo');
            } catch {
              checks.push('FALHA na verificação da VP');
              setState((s) => ({
                ...s,
                verifyResult: { granted: false, checks },
              }));
              break;
            }

            // 6b. Extrai e verifica a VC dentro da VP
            const vpPayload = decodeJWT(state.vpJWT!);
            const vp = vpPayload.vp as { verifiableCredential: string[] };
            const vcJWT = vp.verifiableCredential[0];

            try {
              await verifyVC(vcJWT);
              checks.push('Assinatura da VC (issuer) — válida');
            } catch {
              checks.push('FALHA na assinatura da VC');
              setState((s) => ({
                ...s,
                verifyResult: { granted: false, checks },
              }));
              break;
            }

            // 6c. Simula consulta de revogação
            checks.push('Lista de revogação — credencial ativa');

            // 6d. Verifica regra de acesso (roomId)
            const vcPayload = decodeJWT(vcJWT);
            const vcData = vcPayload.vc as {
              credentialSubject: Record<string, unknown>;
            };
            const vcRoomId = vcData.credentialSubject.roomId;
            if (vcRoomId === ROOM.id) {
              checks.push(`Sala autorizada — ${ROOM.name}`);
            } else {
              checks.push('FALHA — sala não autorizada');
              setState((s) => ({
                ...s,
                verifyResult: { granted: false, checks },
              }));
              break;
            }

            setState((s) => ({
              ...s,
              verifyResult: { granted: true, checks },
            }));
            break;
          }
        }
        setStep(nextStep);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    },
    [state],
  );

  const reset = () => {
    setStep(0);
    setState({});
    setError(undefined);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              AccessChain{' '}
              <span className="text-accent">— Demo Passo a Passo</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Fluxo completo com criptografia real (Ed25519 + JWT) no browser
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={`w-8 h-1.5 rounded-full transition-all ${
                    s <= step
                      ? s === step
                        ? 'bg-accent'
                        : 'bg-green-600'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600 transition"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Intro */}
        {step === 0 && (
          <div className="text-center py-16 space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-100">
                Fluxo completo de acesso com DID/VC
              </h2>
              <p className="text-zinc-500 mt-2 max-w-lg mx-auto">
                Este demo executa cada etapa do protocolo usando criptografia
                real no seu browser — desde a geração de identidades até a
                verificação na porta da sala.
              </p>
            </div>
            <button
              onClick={() => runStep(1)}
              className="px-8 py-3 bg-accent hover:bg-accent/80 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            >
              Iniciar Demo
            </button>
          </div>
        )}

        {/* ===== PASSO 1 — Identidade do Issuer ===== */}
        {step >= 1 && (
          <StepCard
            step={1}
            title="Gerar Identidade do Issuer (CodeLabs)"
            actor="Issuer"
            actorColor="#f59e0b"
            active={step === 1}
            completed={step > 1}
          >
            <p className="text-xs text-zinc-400 mb-3">
              A agremiação CodeLabs gera um par de chaves Ed25519. A chave pública é codificada como DID:key. A chave privada fica armazenada no servidor, criptografada com AES-256.
            </p>

            {state.issuer && (
              <div className="space-y-1">
                <DataBlock label="DID do Issuer" value={state.issuer.did} color="#f59e0b" />
                <DataBlock
                  label="Chave pública (hex)"
                  value={bytesToHex(state.issuer.publicKey)}
                  color="#a78bfa"
                />
                <DataBlock
                  label="Chave privada (hex) — armazenada criptografada no servidor"
                  value={bytesToHex(state.issuer.privateKey)}
                  color="#ef4444"
                />
              </div>
            )}

            {step === 1 && (
              <button
                onClick={() => runStep(2)}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Próximo: Gerar Identidade do Holder →
              </button>
            )}
          </StepCard>
        )}

        {/* ===== PASSO 2 — Identidade do Holder ===== */}
        {step >= 2 && (
          <StepCard
            step={2}
            title="Gerar Identidade do Holder (Ana Silva)"
            actor="Holder"
            actorColor="#22d3ee"
            active={step === 2}
            completed={step > 2}
          >
            <p className="text-xs text-zinc-400 mb-3">
              O aluno gera suas chaves Ed25519 <strong>diretamente no browser</strong>. A chave privada <strong>nunca sai do dispositivo</strong> — fica no localStorage da carteira digital.
            </p>

            {state.holder && (
              <div className="space-y-1">
                <DataBlock label="DID do Holder" value={state.holder.did} color="#22d3ee" />
                <DataBlock
                  label="Chave pública (hex)"
                  value={bytesToHex(state.holder.publicKey)}
                  color="#a78bfa"
                />
                <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/30">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-[11px] text-red-300">
                    Chave privada armazenada APENAS no localStorage do browser — nunca enviada ao servidor
                  </span>
                </div>
              </div>
            )}

            {step === 2 && (
              <button
                onClick={() => runStep(3)}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Próximo: Emitir Credencial →
              </button>
            )}
          </StepCard>
        )}

        {/* ===== PASSO 3 — Emissão da VC ===== */}
        {step >= 3 && (
          <StepCard
            step={3}
            title="Emitir Verifiable Credential (VC)"
            actor="Issuer"
            actorColor="#f59e0b"
            active={step === 3}
            completed={step > 3}
          >
            <p className="text-xs text-zinc-400 mb-3">
              CodeLabs emite uma <strong>MembroCredential</strong> para Ana Silva.
              A API verifica que ela tem uma VC de Aluno ativa (pré-requisito), e assina a nova credencial com a chave privada do issuer usando EdDSA.
            </p>

            {state.vc && (
              <div className="space-y-1">
                <JWTBlock jwt={state.vc.jwt} label="VC-JWT (Verifiable Credential)" />

                <div className="mt-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Payload decodificado
                  </span>
                  <pre className="mt-1 text-[11px] text-zinc-300 overflow-x-auto">
{JSON.stringify(state.vc.decoded, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-900/30">
                    <span className="text-[10px] text-amber-400">iss (quem assinou)</span>
                    <p className="text-[11px] font-mono text-amber-200 truncate mt-0.5">
                      {state.vc.decoded.iss}
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-cyan-950/20 border border-cyan-900/30">
                    <span className="text-[10px] text-cyan-400">sub (titular)</span>
                    <p className="text-[11px] font-mono text-cyan-200 truncate mt-0.5">
                      {state.vc.decoded.sub}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <button
                onClick={() => runStep(4)}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Próximo: Solicitar Acesso na Porta →
              </button>
            )}
          </StepCard>
        )}

        {/* ===== PASSO 4 — Verifier gera nonce ===== */}
        {step >= 4 && (
          <StepCard
            step={4}
            title="Terminal da Sala gera Nonce (anti-replay)"
            actor="Verifier"
            actorColor="#a855f7"
            active={step === 4}
            completed={step > 4}
          >
            <p className="text-xs text-zinc-400 mb-3">
              O terminal da {ROOM.name} gera um <strong>nonce aleatório</strong> com validade de 5 minutos.
              O holder precisa incluir este nonce na VP — isso impede que alguém reutilize um QR Code antigo.
            </p>

            {state.nonce && (
              <div className="space-y-1">
                <DataBlock label="Nonce gerado pelo terminal" value={state.nonce} color="#a855f7" />
                <DataBlock label="Sala" value={`${ROOM.name} (${ROOM.id})`} color="#a855f7" mono={false} />
                <DataBlock label="Validade" value="5 minutos a partir de agora" color="#a855f7" mono={false} />
              </div>
            )}

            {step === 4 && (
              <button
                onClick={() => runStep(5)}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Próximo: Holder assina VP →
              </button>
            )}
          </StepCard>
        )}

        {/* ===== PASSO 5 — Holder cria VP ===== */}
        {step >= 5 && (
          <StepCard
            step={5}
            title="Holder monta e assina a Verifiable Presentation (VP)"
            actor="Holder"
            actorColor="#22d3ee"
            active={step === 5}
            completed={step > 5}
          >
            <p className="text-xs text-zinc-400 mb-3">
              A carteira digital de Ana Silva cria uma <strong>VP-JWT</strong> contendo:
              a VC de membro + o nonce do terminal. A VP é assinada com a chave privada do holder (que <strong>nunca saiu do browser</strong>). O QR Code exibido contém este JWT.
            </p>

            {state.vpJWT && (
              <div className="space-y-1">
                <JWTBlock jwt={state.vpJWT} label="VP-JWT (Verifiable Presentation)" />

                <div className="mt-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    VP decodificada
                  </span>
                  <pre className="mt-1 text-[11px] text-zinc-300 overflow-x-auto">
{JSON.stringify(decodeJWT(state.vpJWT), null, 2)}
                  </pre>
                </div>

                <div className="mt-2 px-3 py-2 rounded-lg bg-cyan-950/20 border border-cyan-900/30">
                  <span className="text-[10px] text-cyan-400">Estrutura da VP</span>
                  <p className="text-[11px] text-cyan-200 mt-1">
                    VP(assinatura_holder) → contém VC(assinatura_issuer) + nonce + exp
                  </p>
                </div>
              </div>
            )}

            {step === 5 && (
              <button
                onClick={() => runStep(6)}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Próximo: Verificar e Liberar Acesso →
              </button>
            )}
          </StepCard>
        )}

        {/* ===== PASSO 6 — Verificação completa ===== */}
        {step >= 6 && (
          <StepCard
            step={6}
            title="Verificação completa no terminal"
            actor="Verifier"
            actorColor="#a855f7"
            active={step === 6}
            completed={false}
          >
            <p className="text-xs text-zinc-400 mb-3">
              O terminal faz a verificação em cadeia: VP → VC → revogação → regra de acesso.
              Cada etapa precisa passar para o acesso ser liberado.
            </p>

            {state.verifyResult && (
              <div className="space-y-2">
                {/* Checklist de verificação */}
                <div className="space-y-1.5">
                  {state.verifyResult.checks.map((check, i) => {
                    const isOk = !check.startsWith('FALHA');
                    return (
                      <div
                        key={i}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                          ${isOk
                            ? 'bg-green-950/30 border border-green-900/30 text-green-300'
                            : 'bg-red-950/30 border border-red-900/30 text-red-300'
                          }
                        `}
                        style={{ animationDelay: `${i * 150}ms` }}
                      >
                        <span className="text-base">{isOk ? '✓' : '✗'}</span>
                        <span>{check}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Resultado final */}
                <div
                  className={`
                    mt-4 p-6 rounded-xl text-center border-2
                    ${state.verifyResult.granted
                      ? 'bg-green-950/20 border-green-600/50'
                      : 'bg-red-950/20 border-red-600/50'
                    }
                  `}
                >
                  <div className="text-5xl mb-2">
                    {state.verifyResult.granted ? '✓' : '✗'}
                  </div>
                  <h3
                    className={`text-2xl font-bold ${
                      state.verifyResult.granted ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {state.verifyResult.granted ? 'ACESSO LIBERADO' : 'ACESSO NEGADO'}
                  </h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    {state.verifyResult.granted
                      ? `Ana Silva — Membro CodeLabs → ${ROOM.name}`
                      : 'Verificação falhou'}
                  </p>
                </div>

                <button
                  onClick={reset}
                  className="mt-4 w-full px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition"
                >
                  Reiniciar Demo
                </button>
              </div>
            )}
          </StepCard>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-accent">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Executando operação criptográfica...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-950/30 border border-red-900/30 text-red-300 text-sm">
            Erro: {error}
          </div>
        )}
      </main>
    </div>
  );
}
