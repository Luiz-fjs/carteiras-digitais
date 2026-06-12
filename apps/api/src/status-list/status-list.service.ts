import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import * as jose from 'jose';

/**
 * W3C Status List 2021 (versão didática para AccessChain).
 *
 * Cada issuer tem um bitmap (Uint8Array). Cada credencial emitida ocupa 1 bit:
 *   - 0 = ativa
 *   - 1 = revogada
 *
 * A Status List é exposta como uma VC assinada (StatusList2021Credential),
 * com a lista codificada em base64url. Verifiers baixam, cacheiam e checam
 * o bit local, sem precisar consultar o backend a cada acesso.
 *
 * Comparado ao approach naive (consulta status no banco a cada verificação):
 *   - Funciona offline (cache local no verifier)
 *   - Privacidade: issuer não vê quem está sendo verificado
 *   - Performance: 1 lookup de bit, milhões/seg
 *   - Padrão W3C real (com simplificações pedagógicas)
 */
@Injectable()
export class StatusListService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private config: ConfigService,
  ) {}

  /** Garante que o issuer tem uma StatusList; cria se não existir. */
  async ensureStatusList(issuerId: string) {
    let sl = await this.prisma.issuerStatusList.findUnique({ where: { issuerId } });
    if (!sl) {
      const capacity = 16384;
      const bytes = Buffer.alloc(capacity / 8); // todos zeros = todas ativas
      sl = await this.prisma.issuerStatusList.create({
        data: { issuerId, bitstring: bytes, capacity, nextIndex: 0 },
      });
    }
    return sl;
  }

  /** Reserva o próximo índice livre para uma nova credencial. */
  async allocateIndex(issuerId: string): Promise<number> {
    const sl = await this.ensureStatusList(issuerId);
    if (sl.nextIndex >= sl.capacity) {
      throw new Error('Status list cheia. Issuer precisa rotacionar para uma nova lista.');
    }
    const index = sl.nextIndex;
    await this.prisma.issuerStatusList.update({
      where: { issuerId },
      data: { nextIndex: index + 1, signedListJwt: null }, // invalida cache
    });
    return index;
  }

  /** Marca um índice como revogado (flipa o bit para 1). */
  async revokeIndex(issuerId: string, index: number) {
    const sl = await this.ensureStatusList(issuerId);
    if (index < 0 || index >= sl.capacity) {
      throw new Error(`Índice ${index} fora dos limites (0..${sl.capacity - 1})`);
    }
    const bytes = Buffer.from(sl.bitstring);
    const byteIdx = Math.floor(index / 8);
    const bitIdx = index % 8;
    bytes[byteIdx] |= (1 << bitIdx);
    await this.prisma.issuerStatusList.update({
      where: { issuerId },
      data: { bitstring: bytes, signedListJwt: null }, // invalida cache
    });
  }

  /** Lê o status de um índice diretamente do banco (uso interno do verifier). */
  async isRevoked(issuerId: string, index: number): Promise<boolean> {
    const sl = await this.ensureStatusList(issuerId);
    if (index < 0 || index >= sl.capacity) return true; // fora dos limites = revogada por segurança
    const byteIdx = Math.floor(index / 8);
    const bitIdx = index % 8;
    const byte = sl.bitstring[byteIdx];
    return (byte & (1 << bitIdx)) !== 0;
  }

  /**
   * Retorna a StatusList como uma VC assinada (StatusList2021Credential).
   * É essa VC que os verifiers baixam, cacheiam e usam.
   *
   * Formato simplificado do W3C:
   * {
   *   vc: {
   *     type: ["VerifiableCredential", "StatusList2021Credential"],
   *     credentialSubject: {
   *       type: "StatusList2021",
   *       statusPurpose: "revocation",
   *       encodedList: base64url(bitstring)
   *     }
   *   },
   *   iss: <did do issuer>
   * }
   */
  async getSignedStatusList(issuerId: string): Promise<string> {
    const sl = await this.ensureStatusList(issuerId);
    if (sl.signedListJwt) return sl.signedListJwt; // cache válido

    const issuer = await this.prisma.issuer.findUniqueOrThrow({ where: { id: issuerId } });
    const secret = this.config.get<string>('ISSUER_KEY_ENCRYPTION_SECRET', '');
    const privateKey = this.crypto.decryptPrivateKey(
      Buffer.from(issuer.encryptedPrivateKey),
      secret,
    );

    const encodedList = jose.base64url.encode(sl.bitstring);

    const key = await jose.importJWK(
      {
        kty: 'OKP',
        crv: 'Ed25519',
        x: jose.base64url.encode(Uint8Array.from(issuer.publicKey)),
        d: jose.base64url.encode(privateKey),
      },
      'EdDSA',
    );

    const jwt = await new jose.SignJWT({
      vc: {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/vc/status-list/2021/v1',
        ],
        type: ['VerifiableCredential', 'StatusList2021Credential'],
        credentialSubject: {
          type: 'StatusList2021',
          statusPurpose: 'revocation',
          encodedList,
        },
      },
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer(issuer.did)
      .setIssuedAt()
      .sign(key);

    // Cacheia o JWT assinado para evitar re-assinar a cada GET
    await this.prisma.issuerStatusList.update({
      where: { issuerId },
      data: { signedListJwt: jwt },
    });

    return jwt;
  }

  /** Para o front mostrar estatísticas no demo. */
  async getStats(issuerId: string) {
    const sl = await this.ensureStatusList(issuerId);
    let revokedCount = 0;
    for (let i = 0; i < sl.nextIndex; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      if (sl.bitstring[byteIdx] & (1 << bitIdx)) revokedCount++;
    }
    return {
      capacity: sl.capacity,
      issued: sl.nextIndex,
      revoked: revokedCount,
      active: sl.nextIndex - revokedCount,
      updatedAt: sl.updatedAt,
    };
  }
}
