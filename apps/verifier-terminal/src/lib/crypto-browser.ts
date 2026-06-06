import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { base58btc } from 'multiformats/bases/base58';
import * as jose from 'jose';

// Configura SHA-512 para @noble/ed25519
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  m.forEach((msg) => h.update(msg));
  return h.digest();
};

const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

export interface KeyPair {
  did: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateDIDKey(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const multicodecKey = new Uint8Array(2 + publicKey.length);
  multicodecKey.set(MULTICODEC_ED25519_PUB);
  multicodecKey.set(publicKey, 2);
  const did = `did:key:${base58btc.encode(multicodecKey)}`;
  return { did, publicKey, privateKey };
}

function didToPublicKey(did: string): Uint8Array {
  const multibaseEncoded = did.slice('did:key:'.length);
  const decoded = base58btc.decode(multibaseEncoded);
  return decoded.slice(2);
}

export interface VCData {
  jwt: string;
  decoded: jose.JWTPayload;
}

export async function signVC(opts: {
  issuerDID: string;
  issuerPrivateKey: Uint8Array;
  subjectDID: string;
  credentialType: string;
  credentialId: string;
  claims: Record<string, unknown>;
  expiresAt?: string;
}): Promise<VCData> {
  const publicKey = didToPublicKey(opts.issuerDID);
  const key = await jose.importJWK(
    {
      kty: 'OKP',
      crv: 'Ed25519',
      x: jose.base64url.encode(publicKey),
      d: jose.base64url.encode(opts.issuerPrivateKey),
    },
    'EdDSA',
  );

  const builder = new jose.SignJWT({
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', opts.credentialType],
      credentialSubject: {
        id: opts.subjectDID,
        ...opts.claims,
      },
    },
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(opts.issuerDID)
    .setSubject(opts.subjectDID)
    .setJti(opts.credentialId)
    .setIssuedAt();

  if (opts.expiresAt) {
    builder.setExpirationTime(new Date(opts.expiresAt));
  }

  const jwt = await builder.sign(key);
  return { jwt, decoded: jose.decodeJwt(jwt) };
}

export async function verifyVC(vcJWT: string): Promise<jose.JWTPayload> {
  const decoded = jose.decodeJwt(vcJWT);
  const issuerDID = decoded.iss!;
  const publicKey = didToPublicKey(issuerDID);
  const key = await jose.importJWK(
    { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(publicKey) },
    'EdDSA',
  );
  const { payload } = await jose.jwtVerify(vcJWT, key, { algorithms: ['EdDSA'] });
  return payload;
}

export async function createVP(opts: {
  holderDID: string;
  holderPrivateKey: Uint8Array;
  vcJWTs: string[];
  nonce: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const publicKey = didToPublicKey(opts.holderDID);
  const key = await jose.importJWK(
    {
      kty: 'OKP',
      crv: 'Ed25519',
      x: jose.base64url.encode(publicKey),
      d: jose.base64url.encode(opts.holderPrivateKey),
    },
    'EdDSA',
  );
  const expiresIn = opts.expiresInSeconds ?? 300;
  return new jose.SignJWT({
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: opts.vcJWTs,
    },
    nonce: opts.nonce,
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(opts.holderDID)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(key);
}

export async function verifyVP(
  vpJWT: string,
  expectedNonce: string,
): Promise<jose.JWTPayload> {
  const decoded = jose.decodeJwt(vpJWT);
  const holderDID = decoded.iss!;
  const publicKey = didToPublicKey(holderDID);
  const key = await jose.importJWK(
    { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(publicKey) },
    'EdDSA',
  );
  const { payload } = await jose.jwtVerify(vpJWT, key, { algorithms: ['EdDSA'] });
  if ((payload as Record<string, unknown>).nonce !== expectedNonce) {
    throw new Error('Nonce inválido');
  }
  return payload;
}

export function decodeJWT(jwt: string): jose.JWTPayload {
  return jose.decodeJwt(jwt);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
