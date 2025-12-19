import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { PrismaService } from '../../common/prisma.service';
import { QuestModule } from '../quest/quest.module';

@Module({
  imports: [QuestModule],
  providers: [ShopService, PrismaService],
  exports: [ShopService],
})
export class ShopModule {}

