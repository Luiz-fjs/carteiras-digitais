import * as jose from 'jose';
import { didToPublicKey } from './did.js';

export interface VCPayload {
  /** DID do issuer que assina a credencial */
  issuer: string;
  /** DID do holder (sujeito da credencial) */
  subject: string;
  /** Tipo da credencial: Aluno, Membro, Colaborador, Coordenacao, Visitante */
  credentialType: string;
  /** ID único da credencial (UUID) */
  credentialId: string;
  /** Claims específicos da credencial (sala, horário, etc.) */
  claims: Record<string, unknown>;
  /** Data de expiração (ISO 8601) — obrigatória para Visitante */
  expiresAt?: string;
}

/**
 * Assina uma Verifiable Credential como JWT (JWS compacto).
 * Usa EdDSA (Ed25519) conforme recomendado pela W3C VC-JWT.
 *
 * O JWT contém:
 * - iss: DID do issuer
 * - sub: DID do holder
 * - jti: ID único da credencial
 * - vc: objeto com tipo e claims da credencial
 */
export async function signVC(
  payload: VCPayload,
  issuerPrivateKey: Uint8Array,
): Promise<string> {
  const privateKeyJWK = await jose.importJWK(
    ed25519PrivateToJWK(issuerPrivateKey, didToPublicKey(payload.issuer)),
    'EdDSA',
  );

  const builder = new jose.SignJWT({
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', payload.credentialType],
      credentialSubject: {
        id: payload.subject,
        ...payload.claims,
      },
    },
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(payload.issuer)
    .setSubject(payload.subject)
    .setJti(payload.credentialId)
    .setIssuedAt();

  if (payload.expiresAt) {
    builder.setExpirationTime(new Date(payload.expiresAt));
  }

  return builder.sign(privateKeyJWK);
}

/**
 * Verifica a assinatura de uma VC-JWT e retorna o payload decodificado.
 * Extrai a chave pública do DID do issuer (campo iss) para validar a assinatura.
 */
export async function verifyVC(vcJWT: string): Promise<jose.JWTPayload> {
  // Decodifica sem verificar para extrair o issuer
  const decoded = jose.decodeJwt(vcJWT);
  const issuerDID = decoded.iss;

  if (!issuerDID || !issuerDID.startsWith('did:key:')) {
    throw new Error('VC inválida: campo "iss" ausente ou não é um DID:key');
  }

  const publicKey = didToPublicKey(issuerDID);
  const publicKeyJWK = await jose.importJWK(
    ed25519PublicToJWK(publicKey),
    'EdDSA',
  );

  const { payload } = await jose.jwtVerify(vcJWT, publicKeyJWK, {
    algorithms: ['EdDSA'],
  });

  return payload;
}

/**
 * Decodifica uma VC-JWT sem verificar a assinatura.
 * Útil para exibir dados na wallet antes da verificação formal.
 */
export function decodeVC(vcJWT: string): jose.JWTPayload {
  return jose.decodeJwt(vcJWT);
}

// --- Helpers de conversão para JWK ---

function ed25519PublicToJWK(publicKey: Uint8Array): jose.JWK {
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: jose.base64url.encode(publicKey),
  };
}

function ed25519PrivateToJWK(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): jose.JWK {
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: jose.base64url.encode(publicKey),
    d: jose.base64url.encode(privateKey),
  };
}
