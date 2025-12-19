import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { AuthModule } from '../auth/auth.module';
import { WorldModule } from '../world/world.module';
import { PartyModule } from '../party/party.module';
import { CombatModule } from '../combat/combat.module';
import { ChatModule } from '../chat/chat.module';
import { QuestModule } from '../quest/quest.module';
import { ShopModule } from '../shop/shop.module';
import { SeasonModule } from '../season/season.module';
import { BossModule } from '../boss/boss.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [AuthModule, WorldModule, PartyModule, CombatModule, ChatModule, QuestModule, ShopModule, SeasonModule, BossModule],
  providers: [WsGateway, PrismaService],
})
export class WsModule {}

