import { Module } from '@nestjs/common';
import { IssuersController } from './issuers.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [IssuersController],
  providers: [PrismaService],
})
export class IssuersModule {}
