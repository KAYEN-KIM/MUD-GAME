import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getReports() {
    return this.prisma.report.findMany({
      include: {
        reporterCharacter: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async createPunishment(targetName: string, type: 'MUTE' | 'BAN', untilAt: Date | null, note: string) {
    return this.prisma.punishment.create({
      data: {
        targetName,
        type,
        untilAt,
        note,
      },
    });
  }

  async deletePunishment(id: string) {
    await this.prisma.punishment.delete({
      where: { id },
    });
  }

  async searchCharacters(name: string) {
    return this.prisma.character.findMany({
      where: {
        name: {
          contains: name,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      take: 20,
    });
  }

  async getStats() {
    // Redis 캐싱 (5분)
    const cacheKey = 'admin:stats';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [
      totalCharacters,
      totalOnline,
      totalGold,
      totalItems,
      totalParties,
      totalGuilds,
      totalQuests,
      totalMonsters,
    ] = await Promise.all([
      this.prisma.character.count(),
      this.prisma.character.count(), // 간단한 온라인 추정 (실제로는 WebSocket 연결 수를 확인해야 함)
      this.prisma.character.aggregate({ _sum: { gold: true } }),
      this.prisma.inventory.count(),
      this.prisma.party.count(),
      (this.prisma as any).guild.count(),
      this.prisma.questTemplate.count(),
      this.prisma.monster.count(),
    ]);

    const stats = {
      totalCharacters,
      totalOnline,
      totalGold: totalGold._sum.gold || 0,
      totalItems,
      totalParties,
      totalGuilds,
      totalQuests,
      totalMonsters,
      timestamp: new Date(),
    };

    // 캐시 저장 (5분)
    await this.redis.set(cacheKey, JSON.stringify(stats), 300);
    return stats;
  }

  async logAdminAction(adminId: string, actionType: string, targetId: string | null, description: string, metadata?: any) {
    return (this.prisma as any).adminLog.create({
      data: {
        adminId,
        actionType,
        targetId,
        description,
        metadata: metadata || null,
      },
    });
  }

  async getAdminLogs(limit = 100) {
    return (this.prisma as any).adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async recordGameStat(statKey: string, statValue: any) {
    return (this.prisma as any).gameStat.create({
      data: {
        statKey,
        statValue: typeof statValue === 'string' ? statValue : JSON.stringify(statValue),
        recordedAt: new Date(),
      },
    });
  }

  async getGameStats(statKey: string, limit = 100) {
    return (this.prisma as any).gameStat.findMany({
      where: { statKey },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }
}

