import * as jose from 'jose';
import { didToPublicKey } from './did.js';

export interface VPOptions {
  /** DID do holder que apresenta a VP */
  holderDID: string;
  /** VCs (como JWTs) a serem incluídas na apresentação */
  vcJWTs: string[];
  /** Nonce fornecido pelo verifier (anti-replay) */
  nonce: string;
  /** Expiração em segundos a partir de agora (padrão: 300 = 5 minutos) */
  expiresInSeconds?: number;
}

/**
 * Cria uma Verifiable Presentation assinada pelo holder.
 * A VP encapsula uma ou mais VCs e inclui:
 * - nonce do verifier (previne replay)
 * - expiração curta (5 min padrão)
 * - assinatura Ed25519 do holder
 */
export async function createVP(
  options: VPOptions,
  holderPrivateKey: Uint8Array,
): Promise<string> {
  const publicKey = didToPublicKey(options.holderDID);

  const privateKeyJWK = await jose.importJWK(
    {
      kty: 'OKP',
      crv: 'Ed25519',
      x: jose.base64url.encode(publicKey),
      d: jose.base64url.encode(holderPrivateKey),
    },
    'EdDSA',
  );

  const expiresIn = options.expiresInSeconds ?? 300;

  return new jose.SignJWT({
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: options.vcJWTs,
    },
    nonce: options.nonce,
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(options.holderDID)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(privateKeyJWK);
}

/**
 * Verifica uma VP-JWT:
 * 1. Valida assinatura do holder
 * 2. Verifica expiração
 * 3. Confere nonce contra o esperado
 *
 * Retorna o payload com as VCs embutidas para verificação individual.
 */
export async function verifyVP(
  vpJWT: string,
  expectedNonce: string,
): Promise<jose.JWTPayload> {
  const decoded = jose.decodeJwt(vpJWT);
  const holderDID = decoded.iss;

  if (!holderDID || !holderDID.startsWith('did:key:')) {
    throw new Error('VP inválida: campo "iss" ausente ou não é um DID:key');
  }

  const publicKey = didToPublicKey(holderDID);
  const publicKeyJWK = await jose.importJWK(
    {
      kty: 'OKP',
      crv: 'Ed25519',
      x: jose.base64url.encode(publicKey),
    },
    'EdDSA',
  );

  const { payload } = await jose.jwtVerify(vpJWT, publicKeyJWK, {
    algorithms: ['EdDSA'],
  });

  // Verifica nonce anti-replay
  if ((payload as Record<string, unknown>).nonce !== expectedNonce) {
    throw new Error(
      `Nonce inválido: esperado "${expectedNonce}", recebido "${(payload as Record<string, unknown>).nonce}"`,
    );
  }

  return payload;
}
