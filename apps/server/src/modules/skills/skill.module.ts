import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [SkillService, PrismaService],
  exports: [SkillService],
})
export class SkillModule {}

