import { Controller, Post, Get, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CredentialsService } from './credentials.service';

interface IssueCredentialDto {
  issuerId: string;
  subjectDid: string;
  credentialType: string;
  claims: Record<string, unknown>;
  expiresAt?: string;
}

@Controller('credentials')
export class CredentialsController {
  constructor(private service: CredentialsService) {}

  @Post('issue')
  async issue(@Body() dto: IssueCredentialDto) {
    try {
      return await this.service.issue(dto);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao emitir credencial';
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cred = await this.service.findOne(id);
    if (!cred) throw new HttpException('Credencial não encontrada', HttpStatus.NOT_FOUND);
    return cred;
  }

  @Get('holder/:did')
  async findByHolder(@Param('did') did: string) {
    return this.service.findByHolder(did);
  }

  @Post(':id/revoke')
  async revoke(@Param('id') id: string, @Body() body: { reason?: string }) {
    try {
      return await this.service.revoke(id, body.reason);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao revogar';
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }
}
