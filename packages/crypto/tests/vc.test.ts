import { describe, it, expect } from 'vitest';
import { generateDIDKey } from '../src/did.js';
import { signVC, verifyVC, decodeVC } from '../src/vc.js';
import { createVP, verifyVP } from '../src/vp.js';

describe('Verifiable Credential (VC)', () => {
  it('deve assinar e verificar uma VC válida', async () => {
    const issuer = await generateDIDKey();
    const holder = await generateDIDKey();

    const vcJWT = await signVC(
      {
        issuer: issuer.did,
        subject: holder.did,
        credentialType: 'AlunoCredential',
        credentialId: 'vc-001',
        claims: { curso: 'Ciência da Computação', campus: 'SJC' },
      },
      issuer.privateKey,
    );

    expect(vcJWT).toBeTruthy();
    expect(vcJWT.split('.')).toHaveLength(3);

    const payload = await verifyVC(vcJWT);
    expect(payload.iss).toBe(issuer.did);
    expect(payload.sub).toBe(holder.did);
    expect(payload.jti).toBe('vc-001');
  });

  it('deve rejeitar uma VC com assinatura inválida', async () => {
    const issuer = await generateDIDKey();
    const holder = await generateDIDKey();
    const attacker = await generateDIDKey();

    // Assina com a chave do atacante mas coloca DID do issuer legítimo
    const vcJWT = await signVC(
      {
        issuer: issuer.did,
        subject: holder.did,
        credentialType: 'AlunoCredential',
        credentialId: 'vc-fake',
        claims: {},
      },
      attacker.privateKey,
    );

    await expect(verifyVC(vcJWT)).rejects.toThrow();
  });

  it('deve decodificar uma VC sem verificar assinatura', async () => {
    const issuer = await generateDIDKey();
    const holder = await generateDIDKey();

    const vcJWT = await signVC(
      {
        issuer: issuer.did,
        subject: holder.did,
        credentialType: 'MembroCredential',
        credentialId: 'vc-002',
        claims: { agremiacao: 'CodeLabs' },
      },
      issuer.privateKey,
    );

    const decoded = decodeVC(vcJWT);
    expect(decoded.iss).toBe(issuer.did);
    expect((decoded as Record<string, unknown>).vc).toBeDefined();
  });
});

describe('Verifiable Presentation (VP)', () => {
  it('deve criar e verificar uma VP com nonce', async () => {
    const issuer = await generateDIDKey();
    const holder = await generateDIDKey();

    const vcJWT = await signVC(
      {
        issuer: issuer.did,
        subject: holder.did,
        credentialType: 'AlunoCredential',
        credentialId: 'vc-003',
        claims: {},
      },
      issuer.privateKey,
    );

    const nonce = 'verifier-nonce-abc123';

    const vpJWT = await createVP(
      {
        holderDID: holder.did,
        vcJWTs: [vcJWT],
        nonce,
      },
      holder.privateKey,
    );

    expect(vpJWT.split('.')).toHaveLength(3);

    const payload = await verifyVP(vpJWT, nonce);
    expect(payload.iss).toBe(holder.did);
    expect((payload as Record<string, unknown>).nonce).toBe(nonce);
  });

  it('deve rejeitar VP com nonce incorreto', async () => {
    const holder = await generateDIDKey();

    const vpJWT = await createVP(
      {
        holderDID: holder.did,
        vcJWTs: [],
        nonce: 'nonce-correto',
      },
      holder.privateKey,
    );

    await expect(verifyVP(vpJWT, 'nonce-errado')).rejects.toThrow('Nonce inválido');
  });
});
