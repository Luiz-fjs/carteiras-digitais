import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import { StatusListService } from '../status-list/status-list.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private statusList: StatusListService,
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

    // W3C Status List 2021: aloca um índice na lista do issuer e adiciona
    // credentialStatus aos claims (cumprindo o data model V1.1)
    const statusListIndex = await this.statusList.allocateIndex(issuer.id);
    const apiBase = process.env.PUBLIC_API_URL || `http://localhost:${process.env.API_PORT || 3000}`;
    const enhancedClaims = {
      ...dto.claims,
      credentialStatus: {
        id: `${apiBase}/status-list/${issuer.id}#${statusListIndex}`,
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListIndex: String(statusListIndex),
        statusListCredential: `${apiBase}/status-list/${issuer.id}`,
      },
    };

    const jwt = await this.crypto.signVC({
      issuerDID: issuer.did,
      issuerPrivateKey: privateKey,
      issuerPublicKey: Uint8Array.from(issuer.publicKey),
      subjectDID: dto.subjectDid,
      credentialType: dto.credentialType,
      credentialId,
      claims: enhancedClaims,
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
        claims: JSON.stringify(enhancedClaims),
        statusListIndex,
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

    // Revoga no banco (mantemos status como "espelho" local) e flipa o bit
    // na Status List 2021 — esta é agora a fonte de verdade descentralizada.
    const revoked = await this.prisma.credential.update({
      where: { id },
      data: { status: 'revoked', revokedAt: new Date(), revocationReason: reason ?? null },
    });
    if (cred.statusListIndex !== null) {
      await this.statusList.revokeIndex(cred.issuerId, cred.statusListIndex);
    }

    // CASCATA SOFT: AlunoCredential da UNIFESP revogada notifica cada issuer
    // dependente. Em produção real, isso seria via webhook entre instituições;
    // aqui simulamos chamando o próprio revoke de cada credencial dependente,
    // o que flipa o bit na status list de cada agremiação separadamente.
    let cascadeRevoked: { id: string; credentialType: string; issuerDid: string }[] = [];
    if (cred.credentialType === 'AlunoCredential') {
      const dependentCreds = await this.prisma.credential.findMany({
        where: {
          subjectDid: cred.subjectDid,
          credentialType: { in: ['MembroCredential', 'ColaboradorCredential', 'VisitanteCredential'] },
          status: 'active',
        },
        select: { id: true, credentialType: true, issuerDid: true, issuerId: true, statusListIndex: true },
      });

      for (const dep of dependentCreds) {
        await this.prisma.credential.update({
          where: { id: dep.id },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: `Cascata: AlunoCredential do mesmo holder revogada (${reason ?? 'sem motivo'})`,
          },
        });
        if (dep.statusListIndex !== null) {
          await this.statusList.revokeIndex(dep.issuerId, dep.statusListIndex);
        }
      }
      cascadeRevoked = dependentCreds.map(d => ({
        id: d.id, credentialType: d.credentialType, issuerDid: d.issuerDid,
      }));
    }

    return {
      ...revoked,
      cascadeRevoked: cascadeRevoked.length,
      cascadeDetails: cascadeRevoked,
    };
  }
}
