import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidation } from './common/config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { WsModule } from './modules/ws/ws.module';
import { WorldModule } from './modules/world/world.module';
import { PartyModule } from './modules/party/party.module';
import { CombatModule } from './modules/combat/combat.module';
import { ChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';
import { QuestModule } from './modules/quest/quest.module';
import { SeasonModule } from './modules/season/season.module';
import { ShopModule } from './modules/shop/shop.module';
import { BossModule } from './modules/boss/boss.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
    }),
    RateLimitModule,
    AuthModule,
    WsModule,
    WorldModule,
    PartyModule,
    CombatModule,
    ChatModule,
    AdminModule,
    SeasonModule,
    QuestModule,
    ShopModule,
    BossModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class AppModule {}

