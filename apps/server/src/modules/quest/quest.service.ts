import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SeasonService } from '../season/season.service';
import { 
  QuestObjective, 
  QuestReward, 
  QuestProgress, 
  QuestTemplateSummary,
  QuestProgressSummary,
  QuestTrackResult,
} from './quest.types';
import { 
  areAllObjectivesComplete, 
  getProgressSummary,
  incrementObjective,
} from './quest.util';
import { getMaxUnlockedSeason, isUnlockedId } from '../../utils/season_lock';

@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonService: SeasonService,
  ) {}

  /**
   * 수락 가능한 퀘스트 목록
   */
  async listAvailable(characterId: string, roomId: string): Promise<QuestTemplateSummary[]> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { level: true },
    });

    if (!character) return [];

    // 현재 방에서 수락 가능한 퀘스트
    const templates = await this.prisma.questTemplate.findMany({
      where: {
        giverRoomId: roomId,
        minLevel: { lte: character.level },
      },
    });

    // 시즌 필터링 + 보너스 주 게이팅
    const currentSeason = this.seasonService.currentSeason;
    const nowUtc = new Date();
    const dayIndex = this.seasonService.getDayIndexInSeason(nowUtc);
    const weekIndex = this.seasonService.getWeekIndexInSeason(dayIndex);
    const maxUnlockedSeason = getMaxUnlockedSeason();

    const filteredBySeasonTemplates = templates.filter(t => {
      // 시즌 잠금: 잠긴 시즌 퀘스트 숨김
      if (!isUnlockedId(t.id, maxUnlockedSeason)) {
        return false;
      }
      
      const seasonNo = this.seasonService.parseSeasonNo(t.id);
      if (seasonNo === null) return true; // 비시즌 퀘스트는 항상 노출

      // 미래 시즌 퀘스트는 숨김
      if (seasonNo > currentSeason) return false;

      // 일일/주간 퀘스트는 현재 시즌에만 노출
      const cadence = this.seasonService.parseCadence(t.id);
      if (cadence && seasonNo !== currentSeason) return false;

      // 보너스 주 게이팅 (패턴 기반)
      const isWeeklyNormal = /^Q_S\d{2}_W\d{2}$/.test(t.id);
      const isWeeklyBonus = /^Q_S\d{2}_WB\d{2}$/.test(t.id);
      const isElite = /^Q_S\d{2}_ELITE_\d{2}$/.test(t.id);

      if (weekIndex === 3) {
        // 3주차: 기존 주간 퀘스트는 새로 수락 불가 (보너스/엘리트만 노출)
        if (isWeeklyNormal) return false;
      } else {
        // 1~2주차: 보너스/엘리트는 숨김
        if (isWeeklyBonus || isElite) return false;
      }

      return true;
    });

    // 이미 수락/완료한 퀘스트 제외 (repeatable=false인 경우)
    const existingProgress = await this.prisma.questProgress.findMany({
      where: {
        characterId,
        questId: { in: filteredBySeasonTemplates.map(t => t.id) },
      },
      select: { questId: true, status: true, turnedInAt: true },
    });

    const existingMap = new Map(existingProgress.map(p => [p.questId, { status: p.status, turnedInAt: p.turnedInAt }]));
    const startOfDayUtc = this.seasonService.startOfKstDayUtc(nowUtc);
    const startOfWeekUtc = this.seasonService.startOfKstWeekUtc(nowUtc);

    return filteredBySeasonTemplates
      .filter(t => {
        const progress = existingMap.get(t.id);
        
        // 진행 중인 퀘스트는 제외
        if (progress && (progress.status === 'ACTIVE' || progress.status === 'COMPLETED')) {
          return false;
        }

        // repeatable=false면 TURNED_IN이면 제외
        if (!t.repeatable && progress?.status === 'TURNED_IN') {
          return false;
        }

        // repeatable=true면 리셋 조건 확인
        if (t.repeatable && progress?.status === 'TURNED_IN') {
          const cadence = this.seasonService.parseCadence(t.id);
          if (!cadence) {
            // repeatable인데 cadence가 없으면 에러 로그 + 제외
            console.error(`[QuestService] repeatable 퀘스트에 cadence가 없습니다: ${t.id}`);
            return false;
          }

          // 일일/주간 리셋 확인
          if (cadence === 'daily') {
            // 오늘 이미 완료했으면 제외
            if (progress.turnedInAt && progress.turnedInAt >= startOfDayUtc) {
              return false;
            }
          } else if (cadence === 'weekly') {
            // 이번 주 이미 완료했으면 제외
            if (progress.turnedInAt && progress.turnedInAt >= startOfWeekUtc) {
              return false;
            }
          }
        }

        return true;
      })
      .map(t => {
        const cadence = this.seasonService.parseCadence(t.id);
        const isMeta = this.seasonService.isMetaQuest(t.id);
        let cadenceType: 'DAILY' | 'WEEKLY' | 'META' | 'STORY' | undefined;
        if (cadence === 'daily') {
          cadenceType = 'DAILY';
        } else if (cadence === 'weekly') {
          cadenceType = 'WEEKLY';
        } else if (isMeta) {
          cadenceType = 'META';
        } else if (t.id.startsWith('Q_S')) {
          cadenceType = 'STORY';
        }

        return {
          questId: t.id,
          title: t.title,
          description: t.description,
          minLevel: t.minLevel,
          giverRoomId: t.giverRoomId,
          turninRoomId: t.turninRoomId,
          repeatable: t.repeatable,
          cadence: cadenceType,
        };
      });
  }

  /**
   * 진행 중/완료된 퀘스트 목록
   */
  async listActive(characterId: string): Promise<QuestProgressSummary[]> {
    const progressList = await this.prisma.questProgress.findMany({
      where: {
        characterId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: {
        quest: true,
      },
    });

    return progressList.map(p => {
      const objectives = (p.quest.objectivesJson as unknown) as QuestObjective[];
      const progress = (p.progressJson as QuestProgress) || {};
      
      const cadence = this.seasonService.parseCadence(p.quest.id);
      const isMeta = this.seasonService.isMetaQuest(p.quest.id);
      let cadenceType: 'DAILY' | 'WEEKLY' | 'META' | 'STORY' | undefined;
      if (cadence === 'daily') {
        cadenceType = 'DAILY';
      } else if (cadence === 'weekly') {
        cadenceType = 'WEEKLY';
      } else if (isMeta) {
        cadenceType = 'META';
      } else if (p.quest.id.startsWith('Q_S')) {
        cadenceType = 'STORY';
      }
      
      return {
        questId: p.questId,
        title: p.quest.title,
        status: p.status as 'ACTIVE' | 'COMPLETED',
        progressSummary: getProgressSummary(objectives, progress),
        objectives,
        progress,
        giverRoomId: p.quest.giverRoomId,
        turninRoomId: p.quest.turninRoomId,
        repeatable: p.quest.repeatable,
        cadence: cadenceType,
      };
    });
  }

  /**
   * 퀘스트 수락
   */
  async acceptQuest(characterId: string, questId: string, roomId: string): Promise<void> {
    const template = await this.prisma.questTemplate.findUnique({
      where: { id: questId },
    });

    if (!template) {
      throw new Error('퀘스트를 찾을 수 없습니다.');
    }
    
    // 시즌 잠금: 잠긴 시즌 퀘스트 수락 차단
    if (!isUnlockedId(questId, getMaxUnlockedSeason())) {
      const { parseSeasonFromId } = require('../../utils/season_lock');
      const season = parseSeasonFromId(questId);
      throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
    }

    if (template.giverRoomId !== roomId) {
      throw new Error('이 방에서는 퀘스트를 수락할 수 없습니다.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { level: true },
    });

    if (!character || character.level < template.minLevel) {
      throw new Error('레벨이 부족합니다.');
    }

    // 보너스 주 게이팅 검증
    const nowUtc = new Date();
    const dayIndex = this.seasonService.getDayIndexInSeason(nowUtc);
    const weekIndex = this.seasonService.getWeekIndexInSeason(dayIndex);

    const isWeeklyNormal = /^Q_S\d{2}_W\d{2}$/.test(questId);
    const isWeeklyBonus = /^Q_S\d{2}_WB\d{2}$/.test(questId);
    const isElite = /^Q_S\d{2}_ELITE_\d{2}$/.test(questId);

    if (weekIndex === 3) {
      // 3주차: 기존 주간 퀘스트 수락 불가
      if (isWeeklyNormal) {
        throw new Error('보너스 주간에는 일반 주간 퀘스트를 수락할 수 없습니다.');
      }
    } else {
      // 1~2주차: 보너스/엘리트 퀘스트 수락 불가
      if (isWeeklyBonus || isElite) {
        throw new Error('보너스 주간 퀘스트는 3주차부터 수락할 수 있습니다.');
      }
    }

    // 이미 진행 중인지 확인
    const existing = await this.prisma.questProgress.findUnique({
      where: { characterId_questId: { characterId, questId } },
    });

    if (existing && existing.status !== 'TURNED_IN') {
      throw new Error('이미 진행 중인 퀘스트입니다.');
    }

    // repeatable=false면 TURNED_IN 있으면 재수락 불가
    if (!template.repeatable && existing?.status === 'TURNED_IN') {
      throw new Error('이미 완료한 퀘스트입니다.');
    }

    // repeatable=true면 리셋 조건 확인
    if (template.repeatable && existing?.status === 'TURNED_IN') {
      const cadence = this.seasonService.parseCadence(questId);
      if (!cadence) {
        throw new Error('반복 퀘스트에는 cadence가 필요합니다.');
      }

      const nowUtc = new Date();
      const startOfDayUtc = this.seasonService.startOfKstDayUtc(nowUtc);
      const startOfWeekUtc = this.seasonService.startOfKstWeekUtc(nowUtc);

      if (cadence === 'daily') {
        // 오늘 이미 완료했으면 재수락 불가
        if (existing.turnedInAt && existing.turnedInAt >= startOfDayUtc) {
          throw new Error('오늘 이미 완료한 퀘스트입니다.');
        }
      } else if (cadence === 'weekly') {
        // 이번 주 이미 완료했으면 재수락 불가
        if (existing.turnedInAt && existing.turnedInAt >= startOfWeekUtc) {
          throw new Error('이번 주 이미 완료한 퀘스트입니다.');
        }
      }
    }

    // 초기 진행도 생성
    const initialProgress: QuestProgress = {};
    ((template.objectivesJson as unknown) as QuestObjective[]).forEach((_, idx) => {
      initialProgress[idx] = 0;
    });

    await this.prisma.questProgress.upsert({
      where: { characterId_questId: { characterId, questId } },
      create: {
        characterId,
        questId,
        status: 'ACTIVE',
        progressJson: initialProgress,
      },
      update: {
        status: 'ACTIVE',
        progressJson: initialProgress,
        acceptedAt: new Date(),
        completedAt: null,
        turnedInAt: null,
      },
    });
  }

  /**
   * 방 방문 시 호출
   */
  async onMove(characterId: string, newRoomId: string): Promise<QuestTrackResult> {
    const activeQuests = await this.prisma.questProgress.findMany({
      where: {
        characterId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: { quest: true },
    });

    let anyChanged = false;
    const completedIds: string[] = [];

    for (const progress of activeQuests) {
      const objectives = (progress.quest.objectivesJson as unknown) as QuestObjective[];
      let progressData = (progress.progressJson as QuestProgress) || {};
      let changed = false;

      objectives.forEach((obj, idx) => {
        if (obj.type === 'VISIT_ROOM' && obj.roomId === newRoomId) {
          progressData = incrementObjective(progressData, idx, 1);
          changed = true;
        }
      });

      if (changed) {
        const isComplete = areAllObjectivesComplete(objectives, progressData);
        await this.prisma.questProgress.update({
          where: { id: progress.id },
          data: {
            progressJson: progressData,
            status: isComplete ? 'COMPLETED' : 'ACTIVE',
            completedAt: isComplete ? new Date() : progress.completedAt,
          },
        });
        anyChanged = true;
        if (isComplete) {
          completedIds.push(progress.questId);
        }
      }
    }

    const active = anyChanged ? await this.listActive(characterId) : [];

    return { changed: anyChanged, active, completedIds };
  }

  /**
   * 전투 종료 시 호출
   */
  async onCombatEnd(
    characterId: string,
    context: { zoneId?: string; monsterId?: string; bossId?: string; isBoss?: boolean },
  ): Promise<QuestTrackResult> {
    const activeQuests = await this.prisma.questProgress.findMany({
      where: {
        characterId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: { quest: true },
    });

    let anyChanged = false;
    const completedIds: string[] = [];

    for (const progress of activeQuests) {
      const objectives = (progress.quest.objectivesJson as unknown) as QuestObjective[];
      let progressData = (progress.progressJson as QuestProgress) || {};
      let changed = false;

      objectives.forEach((obj, idx) => {
        if (obj.type === 'KILL_ANY') {
          progressData = incrementObjective(progressData, idx, 1);
          changed = true;
        } else if (obj.type === 'KILL_IN_ZONE' && obj.zoneId === context.zoneId) {
          // requireBoss가 true일 때는 isBoss가 true여야만 카운트
          if (obj.requireBoss === true && context.isBoss !== true) {
            return; // 보스 킬만 카운트하는데 일반 몬스터면 스킵
          }
          progressData = incrementObjective(progressData, idx, 1);
          changed = true;
        } else if (obj.type === 'KILL_BOSS' && obj.bossId === context.bossId) {
          progressData = incrementObjective(progressData, idx, 1);
          changed = true;
        }
      });

      if (changed) {
        const isComplete = areAllObjectivesComplete(objectives, progressData);
        await this.prisma.questProgress.update({
          where: { id: progress.id },
          data: {
            progressJson: progressData,
            status: isComplete ? 'COMPLETED' : 'ACTIVE',
            completedAt: isComplete ? new Date() : progress.completedAt,
          },
        });
        anyChanged = true;
        if (isComplete) {
          completedIds.push(progress.questId);
        }
      }
    }

    const active = anyChanged ? await this.listActive(characterId) : [];

    return { changed: anyChanged, active, completedIds };
  }

  /**
   * 아이템 획득 시 호출
   */
  async onItemGained(characterId: string, itemId: string, qty: number): Promise<QuestTrackResult> {
    const activeQuests = await this.prisma.questProgress.findMany({
      where: {
        characterId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: { quest: true },
    });

    let anyChanged = false;
    const completedIds: string[] = [];

    for (const progress of activeQuests) {
      const objectives = (progress.quest.objectivesJson as unknown) as QuestObjective[];
      let progressData = (progress.progressJson as QuestProgress) || {};
      let changed = false;

      objectives.forEach((obj, idx) => {
        if (obj.type === 'COLLECT_ITEM' && obj.itemId === itemId) {
          progressData = incrementObjective(progressData, idx, qty);
          changed = true;
        }
      });

      if (changed) {
        const isComplete = areAllObjectivesComplete(objectives, progressData);
        await this.prisma.questProgress.update({
          where: { id: progress.id },
          data: {
            progressJson: progressData,
            status: isComplete ? 'COMPLETED' : 'ACTIVE',
            completedAt: isComplete ? new Date() : progress.completedAt,
          },
        });
        anyChanged = true;
        if (isComplete) {
          completedIds.push(progress.questId);
        }
      }
    }

    const active = anyChanged ? await this.listActive(characterId) : [];

    return { changed: anyChanged, active, completedIds };
  }

  /**
   * 퀘스트 턴인 (보상 지급)
   */
  async turnIn(
    characterId: string,
    questId: string,
    roomId: string,
  ): Promise<{ gold: number; exp: number; items: Array<{ itemId: string; qty: number }> }> {
    return this.prisma.$transaction(async (tx) => {
      const progress = await tx.questProgress.findUnique({
        where: { characterId_questId: { characterId, questId } },
        include: { quest: true },
      });

      if (!progress) {
        throw new Error('퀘스트를 찾을 수 없습니다.');
      }
      
      // 시즌 잠금: 잠긴 시즌 퀘스트 턴인 차단
      if (!isUnlockedId(questId, getMaxUnlockedSeason())) {
        const { parseSeasonFromId } = require('../../utils/season_lock');
        const season = parseSeasonFromId(questId);
        throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
      }

      if (progress.status !== 'COMPLETED') {
        throw new Error('퀘스트가 완료되지 않았습니다.');
      }

      if (progress.quest.turninRoomId !== roomId) {
        throw new Error('이 방에서는 퀘스트를 제출할 수 없습니다.');
      }

      const rewards = progress.quest.rewardsJson as QuestReward;

      // 골드/경험치 지급
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });

      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      const newGold = character.gold + (rewards.gold || 0);
      const newExp = character.exp + (rewards.exp || 0);

      // 레벨업 로직 (간단하게)
      let newLevel = character.level;
      let remainingExp = newExp;
      while (remainingExp >= this.getExpForLevel(newLevel + 1)) {
        remainingExp -= this.getExpForLevel(newLevel + 1);
        newLevel++;
      }

      await tx.character.update({
        where: { id: characterId },
        data: {
          gold: newGold,
          exp: remainingExp,
          level: newLevel,
        },
      });

      // 아이템 지급
      if (rewards.items && rewards.items.length > 0) {
        for (const item of rewards.items) {
          await tx.inventory.upsert({
            where: {
              characterId_itemId: { characterId, itemId: item.itemId },
            },
            create: {
              characterId,
              itemId: item.itemId,
              qty: item.qty,
            },
            update: {
              qty: { increment: item.qty },
            },
          });
        }
      }

      // 퀘스트 상태 업데이트
      await tx.questProgress.update({
        where: { id: progress.id },
        data: {
          status: 'TURNED_IN',
          turnedInAt: new Date(),
        },
      });

      return {
        gold: rewards.gold || 0,
        exp: rewards.exp || 0,
        items: rewards.items || [],
      };
    });
  }

  /**
   * 레벨업 필요 경험치 (간단한 곡선)
   */
  private getExpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }
}

