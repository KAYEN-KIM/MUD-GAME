import { Module } from '@nestjs/common';
import { DungeonService } from './dungeon.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [DungeonService, PrismaService],
  exports: [DungeonService],
})
export class DungeonModule {}

