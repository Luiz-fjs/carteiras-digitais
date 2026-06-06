import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { base58btc } from 'multiformats/bases/base58';

// @noble/ed25519 precisa de um hash SHA-512 configurado
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  m.forEach((msg) => h.update(msg));
  return h.digest();
};

// Prefixo multicodec para ed25519-pub: 0xed 0x01
const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

export interface DIDKeyPair {
  did: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Gera um par de chaves Ed25519 e deriva o DID:key correspondente.
 * O DID:key codifica a chave pública com multicodec + multibase (base58btc).
 * Formato: did:key:z6Mk...
 */
export async function generateDIDKey(): Promise<DIDKeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const did = publicKeyToDID(publicKey);

  return { did, publicKey, privateKey };
}

/**
 * Deriva o DID:key a partir de uma chave pública Ed25519 existente.
 */
export function publicKeyToDID(publicKey: Uint8Array): string {
  // Concatena prefixo multicodec + chave pública
  const multicodecKey = new Uint8Array(
    MULTICODEC_ED25519_PUB.length + publicKey.length,
  );
  multicodecKey.set(MULTICODEC_ED25519_PUB);
  multicodecKey.set(publicKey, MULTICODEC_ED25519_PUB.length);

  // Codifica em base58btc (prefixo 'z')
  const encoded = base58btc.encode(multicodecKey);

  return `did:key:${encoded}`;
}

/**
 * Extrai a chave pública Ed25519 de um DID:key.
 * Valida o prefixo multicodec.
 */
export function didToPublicKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`DID inválido: deve começar com "did:key:z", recebeu "${did}"`);
  }

  const multibaseEncoded = did.slice('did:key:'.length);
  const decoded = base58btc.decode(multibaseEncoded);

  // Verifica prefixo multicodec ed25519-pub
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('DID não usa chave Ed25519 (prefixo multicodec inválido)');
  }

  return decoded.slice(2);
}
