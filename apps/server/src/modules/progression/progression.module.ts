import { Module } from '@nestjs/common';
import { ProgressionService } from './progression.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [ProgressionService, PrismaService],
  exports: [ProgressionService],
})
export class ProgressionModule {}

