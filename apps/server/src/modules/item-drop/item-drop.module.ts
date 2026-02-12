import { Module } from '@nestjs/common';
import { ItemDropService } from './item-drop.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [ItemDropService, PrismaService],
  exports: [ItemDropService],
})
export class ItemDropModule {}

