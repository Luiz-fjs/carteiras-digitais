import { Injectable } from '@nestjs/common';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import * as jose from 'jose';
import * as crypto from 'node:crypto';

// Configura SHA-512
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  m.forEach((msg) => h.update(msg));
  return h.digest();
};

// base58btc decoder inline — substitui `multiformats/bases/base58` que é ESM-only
// e quebra no NestJS (CommonJS). Compatível com o formato did:key (prefixo 'z').
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Map<string, number>();
for (let i = 0; i < BASE58_ALPHABET.length; i++) BASE58_MAP.set(BASE58_ALPHABET[i], i);

function decodeBase58btc(input: string): Uint8Array {
  // 'z' é o prefixo multibase do base58btc; o resto é a string base58 pura
  if (input.startsWith('z')) input = input.slice(1);
  if (input.length === 0) return new Uint8Array(0);

  // Conta zeros à esquerda (cada '1' = byte 0x00)
  let leadingZeros = 0;
  while (leadingZeros < input.length && input[leadingZeros] === '1') leadingZeros++;

  // Decodifica como big integer via array de bytes
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const value = BASE58_MAP.get(input[i]);
    if (value === undefined) throw new Error(`Caractere base58 inválido: ${input[i]}`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>>= 8;
    }
  }

  // Reverte (big-endian) e prefixa zeros
  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) result[leadingZeros + bytes.length - 1 - i] = bytes[i];
  return result;
}

@Injectable()
export class CryptoService {
  decryptPrivateKey(encrypted: Buffer, secret: string): Uint8Array {
    const key = crypto.scryptSync(secret, 'accesschain-salt', 32);
    const iv = encrypted.subarray(0, 16);
    const data = encrypted.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Uint8Array.from(Buffer.concat([decipher.update(data), decipher.final()]));
  }

  async signVC(opts: {
    issuerDID: string;
    issuerPrivateKey: Uint8Array;
    issuerPublicKey: Uint8Array;
    subjectDID: string;
    credentialType: string;
    credentialId: string;
    claims: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<string> {
    const key = await jose.importJWK(
      {
        kty: 'OKP',
        crv: 'Ed25519',
        x: jose.base64url.encode(opts.issuerPublicKey),
        d: jose.base64url.encode(opts.issuerPrivateKey),
      },
      'EdDSA',
    );

    const builder = new jose.SignJWT({
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', opts.credentialType],
        credentialSubject: { id: opts.subjectDID, ...opts.claims },
      },
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer(opts.issuerDID)
      .setSubject(opts.subjectDID)
      .setJti(opts.credentialId)
      .setIssuedAt();

    if (opts.expiresAt) {
      builder.setExpirationTime(opts.expiresAt);
    }

    return builder.sign(key);
  }

  async verifyVC(vcJWT: string): Promise<jose.JWTPayload> {
    const decoded = jose.decodeJwt(vcJWT);
    const issuerDID = decoded.iss;
    if (!issuerDID?.startsWith('did:key:z')) {
      throw new Error('VC inválida: iss não é um DID:key');
    }
    const publicKey = await this.didToPublicKey(issuerDID);
    const key = await jose.importJWK(
      { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(publicKey) },
      'EdDSA',
    );
    const { payload } = await jose.jwtVerify(vcJWT, key, { algorithms: ['EdDSA'] });
    return payload;
  }

  async verifyVP(vpJWT: string, expectedNonce: string): Promise<jose.JWTPayload> {
    const decoded = jose.decodeJwt(vpJWT);
    const holderDID = decoded.iss;
    if (!holderDID?.startsWith('did:key:z')) {
      throw new Error('VP inválida: iss não é um DID:key');
    }
    const publicKey = await this.didToPublicKey(holderDID);
    const key = await jose.importJWK(
      { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(publicKey) },
      'EdDSA',
    );
    const { payload } = await jose.jwtVerify(vpJWT, key, { algorithms: ['EdDSA'] });
    const nonce = (payload as Record<string, unknown>).nonce;
    if (nonce !== expectedNonce) {
      throw new Error('Nonce inválido');
    }
    return payload;
  }

  decodeJWT(jwt: string): jose.JWTPayload {
    return jose.decodeJwt(jwt);
  }

  private async didToPublicKey(did: string): Promise<Uint8Array> {
    const multibaseEncoded = did.slice('did:key:'.length);
    const decoded = decodeBase58btc(multibaseEncoded);
    // remove multicodec prefix (2 bytes: 0xed 0x01 para Ed25519)
    return decoded.slice(2);
  }
}
