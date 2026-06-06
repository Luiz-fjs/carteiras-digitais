import { describe, it, expect } from 'vitest';
import { generateDIDKey, publicKeyToDID, didToPublicKey } from '../src/did.js';

describe('DID:key', () => {
  it('deve gerar um DID:key válido com prefixo correto', async () => {
    const { did, publicKey, privateKey } = await generateDIDKey();

    expect(did).toMatch(/^did:key:z6Mk/);
    expect(publicKey).toHaveLength(32);
    expect(privateKey).toHaveLength(32);
  });

  it('deve derivar o mesmo DID a partir da mesma chave pública', async () => {
    const { did, publicKey } = await generateDIDKey();
    const derivedDID = publicKeyToDID(publicKey);

    expect(derivedDID).toBe(did);
  });

  it('deve extrair a chave pública de um DID:key', async () => {
    const { did, publicKey } = await generateDIDKey();
    const extracted = didToPublicKey(did);

    expect(extracted).toEqual(publicKey);
  });

  it('deve rejeitar DID com formato inválido', () => {
    expect(() => didToPublicKey('did:web:example.com')).toThrow('did:key:z');
  });

  it('deve gerar DIDs distintos para chaves diferentes', async () => {
    const key1 = await generateDIDKey();
    const key2 = await generateDIDKey();

    expect(key1.did).not.toBe(key2.did);
  });
});
