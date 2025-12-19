import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

@Module({
  providers: [ChatService, PrismaService, RedisService, RateLimitService],
  exports: [ChatService],
})
export class ChatModule {}

