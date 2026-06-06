import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';

@Module({
  controllers: [CredentialsController],
  providers: [CredentialsService, PrismaService, CryptoService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
