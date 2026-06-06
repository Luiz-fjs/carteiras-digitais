'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Issuer {
  id: string;
  name: string;
  did: string;
  type: string;
}

interface Room {
  id: string;
  name: string;
}

const CREDENTIAL_TYPES = [
  { value: 'AlunoCredential', label: 'Aluno', issuerType: 'university' },
  { value: 'CoordenacaoCredential', label: 'Coordenação', issuerType: 'university' },
  { value: 'ColaboradorCredential', label: 'Colaborador', issuerType: 'university' },
  { value: 'MembroCredential', label: 'Membro', issuerType: 'association' },
  { value: 'VisitanteCredential', label: 'Visitante', issuerType: 'association' },
];

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function IssuerPortal() {
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [credType, setCredType] = useState('');
  const [subjectDid, setSubjectDid] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string; jwt?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Claims por tipo
  const [nome, setNome] = useState('');
  const [ra, setRa] = useState('');
  const [curso, setCurso] = useState('Ciência da Computação');
  const [campus, setCampus] = useState('SJC');
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [roomId, setRoomId] = useState('');
  const [allowedDay, setAllowedDay] = useState(1);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(16);
  const [funcao, setFuncao] = useState('');

  useEffect(() => {
    fetch(`${API}/issuers`).then(r => r.json()).then(setIssuers).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedIssuer?.type === 'association') {
      fetch(`${API}/issuers/${selectedIssuer.id}/rooms`)
        .then(r => r.json())
        .then((r: Room[]) => { setRooms(r); if (r.length > 0) setRoomId(r[0].id); })
        .catch(() => {});
    } else {
      setRooms([]);
    }
  }, [selectedIssuer]);

  const availableTypes = CREDENTIAL_TYPES.filter(
    t => selectedIssuer && t.issuerType === selectedIssuer.type,
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedIssuer || !credType || !subjectDid) return;
    setLoading(true);
    setResult(null);

    let claims: Record<string, unknown> = { nome };

    switch (credType) {
      case 'AlunoCredential':
        claims = { nome, ra, curso, campus };
        break;
      case 'CoordenacaoCredential':
        claims = { nome, cargo, departamento };
        break;
      case 'ColaboradorCredential':
        claims = { nome, roomId, allowedDay, startHour, endHour, funcao };
        break;
      case 'MembroCredential':
        claims = { nome, roomId, cargo, associationId: selectedIssuer.id };
        break;
      case 'VisitanteCredential':
        claims = { nome, roomId };
        break;
    }

    try {
      const res = await fetch(`${API}/credentials/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerId: selectedIssuer.id,
          subjectDid: subjectDid,
          credentialType: credType,
          claims,
          expiresAt: credType === 'VisitanteCredential'
            ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: `Credencial emitida com sucesso! ID: ${data.id}`, jwt: data.jwt });
      } else {
        setResult({ ok: false, msg: data.message ?? 'Erro ao emitir' });
      }
    } catch (e) {
      setResult({ ok: false, msg: 'Erro de conexão com a API' });
    } finally {
      setLoading(false);
    }
  }, [selectedIssuer, credType, subjectDid, nome, ra, curso, campus, cargo, departamento, roomId, allowedDay, startHour, endHour, funcao]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-bold">
          AccessChain <span className="text-amber-400">— Portal do Issuer</span>
        </h1>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Seleção de Issuer */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">
            Selecione o Issuer (quem vai emitir)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {issuers.map(issuer => (
              <button
                key={issuer.id}
                onClick={() => { setSelectedIssuer(issuer); setCredType(''); setResult(null); }}
                className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left ${
                  selectedIssuer?.id === issuer.id
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div>{issuer.name}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {issuer.type === 'university' ? 'Universidade' : 'Agremiação'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Formulário */}
        {selectedIssuer && (
          <div className="space-y-4 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-semibold text-zinc-200">
              Emitir credencial como <span className="text-amber-400">{selectedIssuer.name}</span>
            </h2>

            {/* Tipo de credencial */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tipo de credencial</label>
              <select
                value={credType}
                onChange={e => setCredType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm"
              >
                <option value="">Selecione...</option>
                {availableTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* DID do Holder */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">DID do Holder (quem recebe)</label>
              <input
                type="text"
                value={subjectDid}
                onChange={e => setSubjectDid(e.target.value)}
                placeholder="did:key:z6Mk..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-mono"
              />
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Nome do titular</label>
              <input
                type="text" value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ana Silva"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm"
              />
            </div>

            {/* Campos específicos por tipo */}
            {credType === 'AlunoCredential' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">RA</label>
                    <input type="text" value={ra} onChange={e => setRa(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Curso</label>
                    <input type="text" value={curso} onChange={e => setCurso(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Campus</label>
                    <input type="text" value={campus} onChange={e => setCampus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                  </div>
                </div>
              </>
            )}

            {credType === 'CoordenacaoCredential' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Cargo</label>
                  <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Departamento</label>
                  <input type="text" value={departamento} onChange={e => setDepartamento(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                </div>
              </div>
            )}

            {credType === 'ColaboradorCredential' && (
              <>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Função</label>
                  <input type="text" value={funcao} onChange={e => setFuncao(e.target.value)}
                    placeholder="Técnico de laboratório"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Dia permitido</label>
                    <select value={allowedDay} onChange={e => setAllowedDay(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm">
                      {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Hora início</label>
                    <input type="number" value={startHour} onChange={e => setStartHour(Number(e.target.value))}
                      min={0} max={23}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Hora fim</label>
                    <input type="number" value={endHour} onChange={e => setEndHour(Number(e.target.value))}
                      min={0} max={23}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
                  </div>
                </div>
              </>
            )}

            {(credType === 'MembroCredential' || credType === 'VisitanteCredential') && rooms.length > 0 && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Sala</label>
                <select value={roomId} onChange={e => setRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm">
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            {credType === 'MembroCredential' && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Cargo na agremiação</label>
                <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
                  placeholder="Desenvolvedor"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm" />
              </div>
            )}

            {/* Botão */}
            <button
              onClick={handleSubmit}
              disabled={loading || !credType || !subjectDid || !nome}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Emitindo...' : 'Emitir Credencial'}
            </button>

            {/* Resultado */}
            {result && (
              <div className={`p-4 rounded-xl border text-sm ${
                result.ok
                  ? 'bg-green-950/30 border-green-800 text-green-300'
                  : 'bg-red-950/30 border-red-800 text-red-300'
              }`}>
                <p className="font-medium">{result.ok ? '✓ Sucesso' : '✗ Erro'}</p>
                <p className="mt-1 text-xs opacity-80">{result.msg}</p>
                {result.jwt && (
                  <div className="mt-2">
                    <p className="text-[10px] text-zinc-500 uppercase">JWT (copie para a carteira)</p>
                    <textarea
                      readOnly
                      value={result.jwt}
                      className="mt-1 w-full h-20 text-[10px] font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-cyan-300"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
