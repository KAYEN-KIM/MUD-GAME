import { Module } from '@nestjs/common';
import { CombatTickService } from './combat-tick.service';
import { CombatTickWorker } from './combat-tick.worker';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ProgressionModule } from '../progression/progression.module';
import { QuestModule } from '../quest/quest.module';

@Module({
  // QuestService는 QuestModule(내부에서 SeasonModule import)로부터 주입받아야 DI가 안전합니다.
  imports: [ProgressionModule, QuestModule],
  providers: [
    CombatTickService,
    CombatTickWorker,
    PrismaService,
    RedisService,
  ],
  exports: [CombatTickService],
})
export class CombatTickModule {}
