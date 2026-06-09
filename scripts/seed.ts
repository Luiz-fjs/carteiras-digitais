/**
 * Seed script — cria os 7 Issuers com pares de chaves Ed25519.
 * Execução: npx tsx scripts/seed.ts
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import crypto from 'node:crypto';
import pg from 'pg';

// Configura SHA-512 para @noble/ed25519
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  m.forEach((msg) => h.update(msg));
  return h.digest();
};

// Importação dinâmica de multiformats (ESM)
const { base58btc } = await import('multiformats/bases/base58');

const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

function publicKeyToDID(publicKey: Uint8Array): string {
  const multicodecKey = new Uint8Array(2 + publicKey.length);
  multicodecKey.set(MULTICODEC_ED25519_PUB);
  multicodecKey.set(publicKey, 2);
  return `did:key:${base58btc.encode(multicodecKey)}`;
}

// Criptografia AES-256-CBC para chaves privadas dos issuers
function encryptPrivateKey(privateKey: Uint8Array, secret: string): Buffer {
  const key = crypto.scryptSync(secret, 'accesschain-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

const ISSUERS = [
  { name: 'UNIFESP', type: 'university' as const },
  { name: 'Scitec JR', type: 'association' as const },
  { name: 'CodeBloco', type: 'association' as const },
  { name: 'CodeLabs', type: 'association' as const },
  { name: 'Enactus', type: 'association' as const },
  { name: 'AAAJA', type: 'association' as const },
  { name: 'Coordenação', type: 'university' as const },
];

// Cada agremiação tem uma sala associada
const ROOMS: Record<string, string> = {
  'Scitec JR': 'Sala Scitec JR',
  'CodeBloco': 'Sala CodeBloco',
  'CodeLabs': 'Sala CodeLabs',
  'Enactus': 'Sala Enactus',
  'AAAJA': 'Sala AAAJA',
};

async function main() {
  const encryptionSecret =
    process.env.ISSUER_KEY_ENCRYPTION_SECRET ?? 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://accesschain:accesschain_dev@localhost:5432/accesschain';

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  console.log('Criando issuers...\n');

  const issuerIds: Record<string, string> = {};

  for (const issuer of ISSUERS) {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    const did = publicKeyToDID(publicKey);
    const encryptedKey = encryptPrivateKey(privateKey, encryptionSecret);

    const result = await client.query(
      `INSERT INTO issuers (name, did, type, public_key, encrypted_private_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET did = $2, public_key = $4, encrypted_private_key = $5
       RETURNING id`,
      [issuer.name, did, issuer.type, publicKey, encryptedKey],
    );

    issuerIds[issuer.name] = result.rows[0].id;
    console.log(`  ✓ ${issuer.name}`);
    console.log(`    DID: ${did}`);
    console.log(`    Tipo: ${issuer.type}\n`);
  }

  console.log('Criando salas...\n');

  for (const [assocName, roomName] of Object.entries(ROOMS)) {
    await client.query(
      `INSERT INTO rooms (name, association_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [roomName, issuerIds[assocName]],
    );
    console.log(`  ✓ ${roomName} → ${assocName}`);
  }

  await client.end();
  console.log('\nSeed concluído!');
}

main().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
