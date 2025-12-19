import { Module } from '@nestjs/common';
import { QuestService } from './quest.service';
import { PrismaService } from '../../common/prisma.service';
import { SeasonModule } from '../season/season.module';

@Module({
  imports: [SeasonModule],
  providers: [QuestService, PrismaService],
  exports: [QuestService],
})
export class QuestModule {}

