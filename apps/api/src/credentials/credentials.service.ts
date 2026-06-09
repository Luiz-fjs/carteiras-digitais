import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private config: ConfigService,
  ) {}

  async issue(dto: {
    issuerId: string;
    subjectDid: string;
    credentialType: string;
    claims: Record<string, unknown>;
    expiresAt?: string;
  }) {
    // Busca issuer com chaves
    const issuer = await this.prisma.issuer.findUniqueOrThrow({
      where: { id: dto.issuerId },
    });

    // Pré-requisito: Membro requer VC de Aluno ativa
    if (dto.credentialType === 'MembroCredential') {
      const alunoVC = await this.prisma.credential.findFirst({
        where: {
          subjectDid: dto.subjectDid,
          credentialType: 'AlunoCredential',
          status: 'active',
        },
      });
      if (!alunoVC) {
        throw new Error(
          'Pré-requisito não atendido: holder precisa de uma credencial de Aluno ativa emitida pela UNIFESP',
        );
      }
    }

    const credentialId = uuid();
    const secret = this.config.get<string>('ISSUER_KEY_ENCRYPTION_SECRET', '');
    const privateKey = this.crypto.decryptPrivateKey(
      Buffer.from(issuer.encryptedPrivateKey),
      secret,
    );

    const jwt = await this.crypto.signVC({
      issuerDID: issuer.did,
      issuerPrivateKey: privateKey,
      issuerPublicKey: Uint8Array.from(issuer.publicKey),
      subjectDID: dto.subjectDid,
      credentialType: dto.credentialType,
      credentialId,
      claims: dto.claims,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    const credential = await this.prisma.credential.create({
      data: {
        id: credentialId,
        credentialType: dto.credentialType,
        issuerId: issuer.id,
        issuerDid: issuer.did,
        subjectDid: dto.subjectDid,
        jwt,
        claims: JSON.stringify(dto.claims),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return { id: credential.id, jwt: credential.jwt, status: credential.status };
  }

  async findOne(id: string) {
    const cred = await this.prisma.credential.findUnique({
      where: { id },
      select: {
        id: true,
        credentialType: true,
        issuerDid: true,
        subjectDid: true,
        jwt: true,
        claims: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        issuer: { select: { name: true } },
      },
    });
    if (cred) {
      return { ...cred, claims: typeof cred.claims === 'string' ? JSON.parse(cred.claims) : cred.claims };
    }
    return cred;
  }

  async findByHolder(did: string) {
    const creds = await this.prisma.credential.findMany({
      where: { subjectDid: did },
      select: {
        id: true,
        credentialType: true,
        issuerDid: true,
        subjectDid: true,
        jwt: true,
        claims: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        issuer: { select: { name: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
    return creds.map((c: typeof creds[number]) => ({ ...c, claims: typeof c.claims === 'string' ? JSON.parse(c.claims) : c.claims }));
  }

  async revoke(id: string, reason?: string) {
    const cred = await this.prisma.credential.findUniqueOrThrow({ where: { id } });
    if (cred.status !== 'active') {
      throw new Error(`Credencial não pode ser revogada — status atual: ${cred.status}`);
    }
    return this.prisma.credential.update({
      where: { id },
      data: { status: 'revoked', revokedAt: new Date(), revocationReason: reason ?? null },
    });
  }
}
