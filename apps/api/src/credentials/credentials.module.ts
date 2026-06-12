import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import { StatusListModule } from '../status-list/status-list.module';

@Module({
  imports: [StatusListModule],
  controllers: [CredentialsController],
  providers: [CredentialsService, PrismaService, CryptoService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
