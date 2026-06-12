import { Module } from '@nestjs/common';
import { StatusListController } from './status-list.controller';
import { StatusListService } from './status-list.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';

@Module({
  controllers: [StatusListController],
  providers: [StatusListService, PrismaService, CryptoService],
  exports: [StatusListService],
})
export class StatusListModule {}
