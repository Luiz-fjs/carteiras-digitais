import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import { v4 as uuid } from 'uuid';

export interface AccessResult {
  granted: boolean;
  reason?: string;
  credentialType?: string;
  holderDid?: string;
}

@Injectable()
export class PresentationsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async createNonce(roomId: string) {
    const nonce = uuid();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    await this.prisma.nonce.create({
      data: { nonce, roomId, expiresAt },
    });
    return { nonce, expiresAt: expiresAt.toISOString() };
  }

  async verifyAccess(vpJWT: string, roomId: string, nonce: string): Promise<AccessResult> {
    // 1. Verifica nonce no banco
    const nonceRecord = await this.prisma.nonce.findUnique({ where: { nonce } });
    if (!nonceRecord) {
      return this.deny(roomId, '', '', 'Nonce não encontrado', null);
    }
    if (nonceRecord.used) {
      return this.deny(roomId, '', '', 'Nonce já utilizado', null);
    }
    if (new Date() > nonceRecord.expiresAt) {
      return this.deny(roomId, '', '', 'Nonce expirado', null);
    }

    // Marca nonce como usado
    await this.prisma.nonce.update({ where: { nonce }, data: { used: true } });

    // 2. Verifica VP (assinatura do holder + expiração + nonce)
    let vpPayload;
    try {
      vpPayload = await this.crypto.verifyVP(vpJWT, nonce);
    } catch {
      return this.deny(roomId, '', '', 'Assinatura da VP inválida ou expirada', null);
    }

    const holderDid = vpPayload.iss ?? '';
    const vp = vpPayload.vp as { verifiableCredential?: string[] } | undefined;
    const vcJWTs = vp?.verifiableCredential ?? [];

    if (vcJWTs.length === 0) {
      return this.deny(roomId, holderDid, '', 'VP não contém credenciais', null);
    }

    // 3. Verifica VC (assinatura do issuer)
    const vcJWT = vcJWTs[0];
    let vcPayload;
    try {
      vcPayload = await this.crypto.verifyVC(vcJWT);
    } catch {
      return this.deny(roomId, holderDid, '', 'Assinatura da VC inválida', null);
    }

    const credentialId = vcPayload.jti ?? '';
    const vcData = vcPayload.vc as {
      type?: string[];
      credentialSubject?: Record<string, unknown>;
    } | undefined;
    const credentialType = vcData?.type?.[1] ?? '';
    const claims = vcData?.credentialSubject ?? {};

    // 4. Consulta revogação no banco
    const credRecord = await this.prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credRecord) {
      return this.deny(roomId, holderDid, credentialType, 'Credencial não encontrada no sistema', null);
    }

    if (credRecord.status === 'revoked') {
      return this.deny(roomId, holderDid, credentialType, 'Credencial revogada pelo emissor', credentialId);
    }

    if (credRecord.status === 'used') {
      return this.deny(roomId, holderDid, credentialType, 'Credencial de visitante já utilizada (uso único)', credentialId);
    }

    if (credRecord.status === 'expired') {
      return this.deny(roomId, holderDid, credentialType, 'Credencial expirada', credentialId);
    }

    // 5. Regras de acesso por tipo
    switch (credentialType) {
      case 'CoordenacaoCredential': {
        // Coordenação tem acesso a qualquer sala a qualquer hora
        return this.grant(roomId, holderDid, credentialType, credentialId);
      }

      case 'MembroCredential': {
        // Membro só acessa a sala da sua agremiação
        const vcRoomId = claims.roomId as string | undefined;
        if (vcRoomId !== roomId) {
          return this.deny(
            roomId, holderDid, credentialType,
            'Credencial não autoriza acesso a esta sala',
            credentialId,
          );
        }
        return this.grant(roomId, holderDid, credentialType, credentialId);
      }

      case 'ColaboradorCredential': {
        const allowedDay = claims.allowedDay as number | undefined;
        const startHour = claims.startHour as number | undefined;
        const endHour = claims.endHour as number | undefined;
        const vcRoomId = claims.roomId as string | undefined;

        if (vcRoomId !== roomId) {
          return this.deny(roomId, holderDid, credentialType, 'Credencial não autoriza acesso a esta sala', credentialId);
        }

        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();

        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        if (allowedDay !== undefined && currentDay !== allowedDay) {
          return this.deny(
            roomId, holderDid, credentialType,
            `Acesso permitido apenas ${dias[allowedDay]} das ${startHour}h às ${endHour}h`,
            credentialId,
          );
        }

        if (startHour !== undefined && endHour !== undefined) {
          if (currentHour < startHour || currentHour >= endHour) {
            return this.deny(
              roomId, holderDid, credentialType,
              `Acesso permitido apenas das ${startHour}h às ${endHour}h`,
              credentialId,
            );
          }
        }

        return this.grant(roomId, holderDid, credentialType, credentialId);
      }

      case 'VisitanteCredential': {
        // Visitante: uso único — marca como "used" atomicamente
        await this.prisma.credential.update({
          where: { id: credentialId },
          data: { status: 'used' },
        });
        return this.grant(roomId, holderDid, credentialType, credentialId);
      }

      case 'AlunoCredential': {
        // Aluno sozinho não dá acesso a sala — precisa ser Membro
        return this.deny(
          roomId, holderDid, credentialType,
          'Credencial de Aluno não autoriza acesso direto — precisa ser Membro de uma agremiação',
          credentialId,
        );
      }

      default:
        return this.deny(roomId, holderDid, credentialType, `Tipo de credencial desconhecido: ${credentialType}`, credentialId);
    }
  }

  async getAccessLogs(roomId: string) {
    return this.prisma.accessLog.findMany({
      where: { roomId },
      orderBy: { verifiedAt: 'desc' },
      take: 50,
    });
  }

  private async grant(
    roomId: string, holderDid: string, credentialType: string, credentialId: string,
  ): Promise<AccessResult> {
    await this.prisma.accessLog.create({
      data: { roomId, subjectDid: holderDid, credentialType, credentialId, granted: true },
    });
    return { granted: true, credentialType, holderDid };
  }

  private async deny(
    roomId: string, holderDid: string, credentialType: string, reason: string, credentialId: string | null,
  ): Promise<AccessResult> {
    await this.prisma.accessLog.create({
      data: { roomId, subjectDid: holderDid || 'unknown', credentialType: credentialType || 'unknown', credentialId, granted: false, reason },
    });
    return { granted: false, reason, credentialType, holderDid };
  }
}
