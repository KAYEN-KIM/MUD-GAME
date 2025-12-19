import { Module } from '@nestjs/common';
import { BossService } from './boss.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [BossService, PrismaService],
  exports: [BossService],
})
export class BossModule {}

