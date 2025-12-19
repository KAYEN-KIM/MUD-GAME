import { Module, Global } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../common/redis.service';

@Global()
@Module({
  providers: [RateLimitService, RedisService],
  exports: [RateLimitService],
})
export class RateLimitModule {}

