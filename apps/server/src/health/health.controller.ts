import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { getEffectiveMaxUnlockedSeason } from '../common/config/env.validation';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  async getHealth() {
    const checks: Record<string, boolean> = {};

    // DB health check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Redis health check
    try {
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const allHealthy = Object.values(checks).every((v) => v);

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: Date.now(),
      testMode: process.env.TEST_MODE === 'true',
      maxUnlockedSeason: getEffectiveMaxUnlockedSeason(),
      checks,
    };
  }
}


