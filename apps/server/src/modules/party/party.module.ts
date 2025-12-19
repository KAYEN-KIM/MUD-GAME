import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [PartyService, PrismaService],
  exports: [PartyService],
})
export class PartyModule {}

