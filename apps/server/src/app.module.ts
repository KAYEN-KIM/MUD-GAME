import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidation } from './common/config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { WsModule } from './modules/ws/ws.module';
import { WorldModule } from './modules/world/world.module';
import { PartyModule } from './modules/party/party.module';
import { CombatModule } from './modules/combat/combat.module';
import { CombatTickModule } from './modules/combat-tick/combat-tick.module';
import { ChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';
import { SeasonModule } from './modules/season/season.module';
import { QuestModule } from './modules/quest/quest.module';
import { ShopModule } from './modules/shop/shop.module';
import { BossModule } from './modules/boss/boss.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { SkillModule } from './modules/skills/skill.module';
import { DungeonModule } from './modules/dungeon/dungeon.module';
import { ItemDropModule } from './modules/item-drop/item-drop.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),
    RateLimitModule,
    AuthModule,
    WsModule,
    WorldModule,
    PartyModule,
    CombatModule,
    CombatTickModule,
    ChatModule,
    AdminModule,
    SeasonModule,
    QuestModule,
    ShopModule,
    BossModule,
    ProgressionModule,
    SkillModule,
    DungeonModule,
    ItemDropModule,
  ],
})
export class AppModule {}
