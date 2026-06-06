// Tipos compartilhados do AccessChain

export type DID = `did:key:${string}`;

export type CredentialType =
  | 'AlunoCredential'
  | 'CoordenacaoCredential'
  | 'ColaboradorCredential'
  | 'MembroCredential'
  | 'VisitanteCredential';

export type CredentialStatus = 'active' | 'revoked' | 'expired' | 'used';

export interface VerifiableCredential {
  id: string;
  type: CredentialType;
  issuerDID: DID;
  subjectDID: DID;
  jwt: string;
  claims: Record<string, unknown>;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string;
}

export interface VerifiablePresentation {
  holderDID: DID;
  vcJWTs: string[];
  nonce: string;
  jwt: string;
}

export interface AccessRule {
  credentialType: CredentialType;
  roomId: string;
  /** Para Colaborador: dia da semana permitido (0=dom, 1=seg, ..., 6=sab) */
  allowedDay?: number;
  /** Para Colaborador: hora de início (0-23) */
  startHour?: number;
  /** Para Colaborador: hora de fim (0-23) */
  endHour?: number;
}

export interface AccessVerificationResult {
  granted: boolean;
  reason?: string;
  credentialType?: CredentialType;
  holderDID?: DID;
  timestamp: string;
}

export interface Issuer {
  id: string;
  name: string;
  did: DID;
  type: 'university' | 'association';
}

export interface Room {
  id: string;
  name: string;
  associationId: string;
}

/** Claims específicos por tipo de credencial */
export interface AlunoClaims {
  ra: string;
  curso: string;
  campus: string;
}

export interface CoordenacaoClaims {
  cargo: string;
  departamento: string;
}

export interface ColaboradorClaims {
  roomId: string;
  allowedDay: number;
  startHour: number;
  endHour: number;
  funcao: string;
}

export interface MembroClaims {
  associationId: string;
  roomId: string;
  cargo?: string;
}

export interface VisitanteClaims {
  roomId: string;
  aprovadoPor: DID;
  nomeVisitante: string;
  emailVisitante: string;
}
