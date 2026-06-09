import { PrismaClient } from '@prisma/client';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import * as crypto from 'node:crypto';

ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  m.forEach((msg) => h.update(msg));
  return h.digest();
};

const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

async function publicKeyToDID(publicKey: Uint8Array): Promise<string> {
  const { base58btc } = await import('multiformats/bases/base58');
  const multicodecKey = new Uint8Array(2 + publicKey.length);
  multicodecKey.set(MULTICODEC_ED25519_PUB);
  multicodecKey.set(publicKey, 2);
  return `did:key:${base58btc.encode(multicodecKey)}`;
}

function encryptPrivateKey(privateKey: Uint8Array, secret: string): Buffer {
  const key = crypto.scryptSync(secret, 'accesschain-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

const ISSUERS = [
  { name: 'UNIFESP', type: 'university' },
  { name: 'Coordenação', type: 'university' },
  { name: 'Scitec JR', type: 'association' },
  { name: 'CodeBloco', type: 'association' },
  { name: 'CodeLabs', type: 'association' },
  { name: 'Enactus', type: 'association' },
  { name: 'AAAJA', type: 'association' },
];

const ROOMS: Record<string, string> = {
  'Scitec JR': 'Sala Scitec JR',
  'CodeBloco': 'Sala CodeBloco',
  'CodeLabs': 'Sala CodeLabs',
  'Enactus': 'Sala Enactus',
  'AAAJA': 'Sala AAAJA',
};

async function main() {
  const prisma = new PrismaClient();
  const secret = process.env.ISSUER_KEY_ENCRYPTION_SECRET ?? 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

  console.log('Criando issuers...\n');

  const issuerIds: Record<string, string> = {};

  for (const issuer of ISSUERS) {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    const did = await publicKeyToDID(publicKey);
    const encryptedKey = encryptPrivateKey(privateKey, secret);

    const created = await prisma.issuer.upsert({
      where: { name: issuer.name },
      update: { did, publicKey: Buffer.from(publicKey), encryptedPrivateKey: encryptedKey },
      create: { name: issuer.name, did, type: issuer.type, publicKey: Buffer.from(publicKey), encryptedPrivateKey: encryptedKey },
    });

    issuerIds[issuer.name] = created.id;
    console.log(`  ✓ ${issuer.name} — ${did.slice(0, 30)}...`);
  }

  console.log('\nCriando salas...\n');

  for (const [assocName, roomName] of Object.entries(ROOMS)) {
    const existing = await prisma.room.findFirst({
      where: { name: roomName, associationId: issuerIds[assocName] },
    });
    if (!existing) {
      await prisma.room.create({
        data: { name: roomName, associationId: issuerIds[assocName] },
      });
    }
    console.log(`  ✓ ${roomName} → ${assocName}`);
  }

  await prisma.$disconnect();
  console.log('\nSeed concluído!');
}

main().catch(e => { console.error(e); process.exit(1); });
