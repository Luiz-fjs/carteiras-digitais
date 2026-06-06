import type { DemoScenario } from './types';

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    label: 'Membro CodeLabs',
    type: 'MembroCredential',
    granted: true,
    holderName: 'Ana Silva',
  },
  {
    label: 'Coordenação',
    type: 'CoordenacaoCredential',
    granted: true,
    holderName: 'Prof. Carlos Mendes',
  },
  {
    label: 'Colaborador (dentro do horário)',
    type: 'ColaboradorCredential',
    granted: true,
    holderName: 'João Pereira',
  },
  {
    label: 'Visitante (uso único)',
    type: 'VisitanteCredential',
    granted: true,
    holderName: 'Maria Oliveira',
  },
  {
    label: 'Colaborador (fora do horário)',
    type: 'ColaboradorCredential',
    granted: false,
    reason: 'Acesso permitido apenas Terça das 9h às 16h',
    holderName: 'Pedro Santos',
  },
  {
    label: 'Credencial revogada',
    type: 'MembroCredential',
    granted: false,
    reason: 'Credencial revogada pelo emissor',
    holderName: 'Lucas Costa',
  },
  {
    label: 'Visitante (já utilizado)',
    type: 'VisitanteCredential',
    granted: false,
    reason: 'Credencial de visitante já utilizada (uso único)',
    holderName: 'Fernanda Lima',
  },
  {
    label: 'VP expirada',
    type: 'AlunoCredential',
    granted: false,
    reason: 'Apresentação expirada (validade de 5 minutos)',
    holderName: 'Rafael Nunes',
  },
  {
    label: 'Sala incorreta',
    type: 'MembroCredential',
    granted: false,
    reason: 'Credencial não autoriza acesso a esta sala',
    holderName: 'Camila Rocha',
  },
];
