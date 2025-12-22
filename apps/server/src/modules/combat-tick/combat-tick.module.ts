import { Module } from '@nestjs/common';
import { CombatTickService } from './combat-tick.service';
import { CombatTickWorker } from './combat-tick.worker';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Module({
  providers: [CombatTickService, CombatTickWorker, PrismaService, RedisService],
  exports: [CombatTickService],
})
export class CombatTickModule {}

