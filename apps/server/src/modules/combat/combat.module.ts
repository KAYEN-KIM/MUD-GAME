import { Module } from '@nestjs/common';
import { CombatService } from './combat.service';
import { BossModule } from '../boss/boss.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [BossModule],
  providers: [CombatService, PrismaService],
  exports: [CombatService],
})
export class CombatModule {}

