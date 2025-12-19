import { Injectable } from '@nestjs/common';
import { getMaxUnlockedSeason } from '../../utils/season_lock';

@Injectable()
export class SeasonService {
  private readonly KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

  /**
   * 시즌 에포크 (KST 기준)
   * 환경 변수로 설정 가능, 기본값: 2025-12-17T00:00:00+09:00
   */
  private get seasonEpochIso(): string {
    return process.env.SEASON_EPOCH_ISO || '2025-12-17T00:00:00+09:00';
  }

  /**
   * 시즌 길이 (일)
   * 환경 변수로 설정 가능, 기본값: 21일 (3주)
   */
  private get seasonLengthDays(): number {
    const envVal = process.env.SEASON_LENGTH_DAYS;
    return envVal ? parseInt(envVal, 10) : 21;
  }

  /**
   * 현재 시즌 번호 계산 (1부터 시작)
   * @returns 현재 시즌 번호
   */
  get currentSeason(): number {
    const nowUtc = new Date();
    const epochUtc = new Date(this.seasonEpochIso);
    const diffMs = nowUtc.getTime() - epochUtc.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    const seasonIndex = Math.floor(diffDays / this.seasonLengthDays);
    return Math.max(1, seasonIndex + 1); // 최소 시즌 1
  }

  /**
   * KST 기준 현재 시각
   */
  kstNow(): Date {
    return new Date(Date.now() + this.KST_OFFSET_MS);
  }

  /**
   * KST 기준 오늘 00:00:00의 UTC 시각
   * @param nowUtc 기준 UTC 시각 (기본값: 현재 시각)
   */
  startOfKstDayUtc(nowUtc: Date = new Date()): Date {
    const kst = new Date(nowUtc.getTime() + this.KST_OFFSET_MS);
    const startKstMs = Date.UTC(
      kst.getUTCFullYear(),
      kst.getUTCMonth(),
      kst.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    return new Date(startKstMs - this.KST_OFFSET_MS);
  }

  /**
   * KST 기준 이번 주 월요일 00:00:00의 UTC 시각
   * @param nowUtc 기준 UTC 시각 (기본값: 현재 시각)
   */
  startOfKstWeekUtc(nowUtc: Date = new Date()): Date {
    const kst = new Date(nowUtc.getTime() + this.KST_OFFSET_MS);
    const dow = kst.getUTCDay(); // 0=Sun..6=Sat
    const mondayIndex = (dow + 6) % 7; // Mon=0..Sun=6
    const startDayUtc = this.startOfKstDayUtc(nowUtc);
    return new Date(startDayUtc.getTime() - mondayIndex * 24 * 60 * 60 * 1000);
  }

  /**
   * 퀘스트 ID에서 시즌 번호 추출
   * @param questId 퀘스트 ID (예: Q_S01_D01)
   * @returns 시즌 번호 (없으면 null)
   */
  parseSeasonNo(questId: string): number | null {
    const m = questId.match(/^Q_S(\d{2})_/);
    return m ? parseInt(m[1], 10) : null;
  }

  /**
   * 퀘스트 ID에서 cadence(일일/주간) 판단
   * @param questId 퀘스트 ID
   * @returns 'daily' | 'weekly' | null
   */
  parseCadence(questId: string): 'daily' | 'weekly' | null {
    if (/^Q_S\d{2}_D/.test(questId)) return 'daily';
    if (/^Q_S\d{2}_W/.test(questId)) return 'weekly';
    return null;
  }

  /**
   * 퀘스트가 메타 퀘스트인지 확인
   * @param questId 퀘스트 ID
   */
  isMetaQuest(questId: string): boolean {
    return /^Q_S\d{2}_META/.test(questId);
  }

  /**
   * 시즌 내 dayIndex 계산 (1..21, KST 기준)
   * @param nowUtc 기준 UTC 시각 (기본값: 현재 시각)
   * @returns 시즌 내 일차 (1부터 시작)
   */
  getDayIndexInSeason(nowUtc: Date = new Date()): number {
    const epochUtc = new Date(this.seasonEpochIso);
    const currentSeason = this.currentSeason;
    const seasonLengthDays = this.seasonLengthDays;

    const seasonStartUtcMs =
      epochUtc.getTime() + (currentSeason - 1) * seasonLengthDays * 24 * 60 * 60 * 1000;

    const kstNow = new Date(nowUtc.getTime() + this.KST_OFFSET_MS);
    const kstSeasonStart = new Date(seasonStartUtcMs + this.KST_OFFSET_MS);
    const diffDays = Math.floor(
      (kstNow.getTime() - kstSeasonStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    return Math.max(1, Math.min(seasonLengthDays, diffDays + 1));
  }

  /**
   * 시즌 내 주차 계산 (1..3)
   * @param dayIndex 시즌 내 일차 (1..21)
   * @returns 주차 (1=1~7일, 2=8~14일, 3=15~21일)
   */
  getWeekIndexInSeason(dayIndex: number): number {
    const weekIndex = Math.ceil(dayIndex / 7);
    return Math.min(3, Math.max(1, weekIndex));
  }

  /**
   * 시즌 상태 정보 반환 (UI용)
   * @param nowUtc 기준 UTC 시각 (기본값: 현재 시각)
   */
  getSeasonStatus(nowUtc: Date = new Date()): {
    serverNowUtcMs: number;
    currentSeason: number;
    seasonStartUtcMs: number;
    seasonEndUtcMs: number;
    nextDailyResetUtcMs: number;
    nextWeeklyResetUtcMs: number;
    seasonLengthDays: number;
    dayIndexInSeason: number;
    maxUnlockedSeason: number;
  } {
    const epochUtc = new Date(this.seasonEpochIso);
    const currentSeason = this.currentSeason;
    const seasonLengthDays = this.seasonLengthDays;

    // 현재 시즌 시작 시각 (UTC ms)
    const seasonStartUtcMs =
      epochUtc.getTime() + (currentSeason - 1) * seasonLengthDays * 24 * 60 * 60 * 1000;

    // 현재 시즌 종료 시각 (UTC ms)
    const seasonEndUtcMs = seasonStartUtcMs + seasonLengthDays * 24 * 60 * 60 * 1000;

    // 다음 일일 리셋 (KST 기준 다음날 00:00 -> UTC)
    const todayStartKstUtc = this.startOfKstDayUtc(nowUtc);
    const nextDailyResetUtcMs = todayStartKstUtc.getTime() + 24 * 60 * 60 * 1000;

    // 다음 주간 리셋 (KST 기준 다음 월요일 00:00 -> UTC)
    const thisWeekStartKstUtc = this.startOfKstWeekUtc(nowUtc);
    const nextWeeklyResetUtcMs = thisWeekStartKstUtc.getTime() + 7 * 24 * 60 * 60 * 1000;

    // 시즌 내 일차 (1..21, KST 기준)
    const dayIndexInSeason = this.getDayIndexInSeason(nowUtc);

    return {
      serverNowUtcMs: nowUtc.getTime(),
      currentSeason,
      seasonStartUtcMs,
      seasonEndUtcMs,
      nextDailyResetUtcMs,
      nextWeeklyResetUtcMs,
      seasonLengthDays,
      dayIndexInSeason,
      maxUnlockedSeason: getMaxUnlockedSeason(),
    };
  }
}

