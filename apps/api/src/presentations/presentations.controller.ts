import { Controller, Post, Get, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PresentationsService } from './presentations.service';

@Controller('presentations')
export class PresentationsController {
  constructor(private service: PresentationsService) {}

  @Post('nonce')
  async createNonce(@Body() body: { roomId: string }) {
    return this.service.createNonce(body.roomId);
  }

  @Post('verify')
  async verify(@Body() body: { vpJWT: string; roomId: string; nonce: string }) {
    try {
      return await this.service.verifyAccess(body.vpJWT, body.roomId, body.nonce);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro na verificação';
      throw new HttpException(
        { granted: false, reason: msg },
        HttpStatus.OK,
      );
    }
  }

  @Get('logs/:roomId')
  async getLogs(@Param('roomId') roomId: string) {
    return this.service.getAccessLogs(roomId);
  }
}
