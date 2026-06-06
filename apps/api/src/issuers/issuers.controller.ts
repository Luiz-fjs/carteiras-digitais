import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('issuers')
export class IssuersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const issuers = await this.prisma.issuer.findMany({
      select: { id: true, name: true, did: true, type: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return issuers;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.issuer.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, did: true, type: true, createdAt: true },
    });
  }

  @Get(':id/rooms')
  async getRooms(@Param('id') id: string) {
    return this.prisma.room.findMany({
      where: { associationId: id },
      select: { id: true, name: true },
    });
  }
}
