import { Module } from '@nestjs/common';
import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';
import { StatusListModule } from '../status-list/status-list.module';

@Module({
  imports: [StatusListModule],
  controllers: [PresentationsController],
  providers: [PresentationsService, PrismaService, CryptoService],
})
export class PresentationsModule {}
