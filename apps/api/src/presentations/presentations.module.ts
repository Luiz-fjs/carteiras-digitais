import { Module } from '@nestjs/common';
import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';

@Module({
  controllers: [PresentationsController],
  providers: [PresentationsService, PrismaService, CryptoService],
})
export class PresentationsModule {}
