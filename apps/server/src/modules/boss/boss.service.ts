import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { BossSpawnConfig, BossSpawnsData } from './boss.types';

@Injectable()
export class BossService {
  private spawns: Map<string, BossSpawnConfig> = new Map();
  private isTestMode: boolean;

  constructor(private readonly prisma: PrismaService) {
    this.isTestMode = process.env.TEST_MODE === 'true';
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'content', 'boss_spawns.json');
      if (!fs.existsSync(configPath)) {
        console.warn('[BossService] boss_spawns.json not found, boss encounters disabled');
        return;
      }

      const data: BossSpawnsData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      data.spawns.forEach((spawn) => {
        this.spawns.set(spawn.roomId, spawn);
      });

      console.log(`[BossService] Loaded ${this.spawns.size} boss spawn(s)`);
      if (this.isTestMode) {
        console.log('[BossService] TEST_MODE=true: cooldowns disabled');
      }
    } catch (error) {
      console.error('[BossService] Failed to load boss_spawns.json:', error);
    }
  }

  getSpawnByRoom(roomId: string): BossSpawnConfig | null {
    return this.spawns.get(roomId) || null;
  }

  /**
   * 마지막 보스 처치 시각 조회 (DB-backed)
   */
  async getLastKilledAt(roomId: string, bossId: string): Promise<Date | null> {
    // TEST_MODE에서는 항상 null 반환 (쿨다운 우회)
    if (this.isTestMode) {
      return null;
    }

    try {
      const row = await this.prisma.bossKillLog.findUnique({
        where: { roomId_bossId: { roomId, bossId } },
      });
      return row?.killedAt ?? null;
    } catch (error) {
      console.error(`[BossService] getLastKilledAt failed for ${roomId}/${bossId}:`, error);
      return null;
    }
  }

  async isBossAvailable(roomId: string, now: Date = new Date()): Promise<boolean> {
    // TEST_MODE에서는 항상 사용 가능
    if (this.isTestMode) {
      return true;
    }

    const spawn = this.spawns.get(roomId);
    if (!spawn) {
      return false;
    }

    const lastKilledAt = await this.getLastKilledAt(roomId, spawn.bossId);
    if (!lastKilledAt) {
      return true;
    }

    const elapsedSec = (now.getTime() - lastKilledAt.getTime()) / 1000;
    return elapsedSec >= spawn.cooldownSec;
  }

  async getCooldownRemainingSec(roomId: string, now: Date = new Date()): Promise<number> {
    const spawn = this.spawns.get(roomId);
    if (!spawn) {
      return 0;
    }

    const lastKilledAt = await this.getLastKilledAt(roomId, spawn.bossId);
    if (!lastKilledAt) {
      return 0;
    }

    const elapsedSec = (now.getTime() - lastKilledAt.getTime()) / 1000;
    const remaining = spawn.cooldownSec - elapsedSec;
    return Math.max(0, Math.ceil(remaining));
  }

  async markBossKilled(roomId: string, now: Date = new Date()): Promise<void> {
    const spawn = this.spawns.get(roomId);
    if (!spawn) {
      console.warn(`[BossService] markBossKilled called for unknown room: ${roomId}`);
      return;
    }

    // TEST_MODE에서는 DB write 생략 (테스트 속도 유지)
    if (this.isTestMode) {
      console.log(`[BossService] TEST_MODE: Boss killed in ${roomId} (DB write skipped)`);
      return;
    }

    try {
      await this.prisma.bossKillLog.upsert({
        where: { roomId_bossId: { roomId, bossId: spawn.bossId } },
        create: { roomId, bossId: spawn.bossId, killedAt: now },
        update: { killedAt: now },
      });
      console.log(`[BossService] Boss killed in ${roomId} (${spawn.bossId}) at ${now.toISOString()}`);
    } catch (error) {
      console.error(`[BossService] Failed to log boss kill for ${roomId}:`, error);
    }
  }

  /**
   * 테스트 격리용: 보스 쿨다운 상태 초기화
   * TEST_MODE에서만 호출 가능
   */
  async resetForTests(): Promise<void> {
    if (!this.isTestMode) {
      console.warn('[BossService] resetForTests() called outside TEST_MODE, ignored');
      return;
    }
    
    // DB에서 모든 BossKillLog 삭제
    try {
      await this.prisma.bossKillLog.deleteMany({});
      console.log('[BossService] Test state reset: all boss kill logs cleared');
    } catch (error) {
      console.error('[BossService] resetForTests() failed:', error);
    }
  }
}

