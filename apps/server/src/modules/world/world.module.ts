import { Module } from '@nestjs/common';
import { WorldService } from './world.service';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

@Module({
  providers: [WorldService, PrismaService, RedisService, RateLimitService],
  exports: [WorldService],
})
export class WorldModule {}

