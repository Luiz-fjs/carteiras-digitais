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
    const publicKey = this.didToPublicKey(issuerDID);
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
    const publicKey = this.didToPublicKey(holderDID);
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

  private didToPublicKey(did: string): Uint8Array {
    // Importação síncrona do base58btc via require para CommonJS
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { base58btc } = require('multiformats/bases/base58');
    const multibaseEncoded = did.slice('did:key:'.length);
    const decoded = base58btc.decode(multibaseEncoded);
    return decoded.slice(2);
  }
}
