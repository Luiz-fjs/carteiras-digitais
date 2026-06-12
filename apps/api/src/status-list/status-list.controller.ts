import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { StatusListService } from './status-list.service';

/**
 * Endpoints públicos da Status List 2021.
 *
 * O verifier (porta) faz GET /status-list/<issuerId> periodicamente,
 * cacheia a resposta e usa para checar revogações offline.
 */
@Controller('status-list')
export class StatusListController {
  constructor(private service: StatusListService) {}

  /** Retorna a StatusList2021Credential assinada (JWT). */
  @Get(':issuerId')
  async getList(@Param('issuerId') issuerId: string) {
    try {
      const jwt = await this.service.getSignedStatusList(issuerId);
      return { statusListCredential: jwt };
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : 'Erro ao gerar status list',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /** Estatísticas (capacidade, emitidas, revogadas) — útil pra demo. */
  @Get(':issuerId/stats')
  async getStats(@Param('issuerId') issuerId: string) {
    return this.service.getStats(issuerId);
  }
}
