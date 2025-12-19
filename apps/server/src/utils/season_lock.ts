/**
 * Season Lock Utilities
 * 
 * 시즌 잠금 정책:
 * 1. MAX_UNLOCKED_SEASON 환경변수가 설정되면 그 값을 최우선으로 사용 (1~99)
 * 2. MAX_UNLOCKED_SEASON이 없고 TEST_MODE=true이면 잠금 우회 (사실상 99)
 * 3. MAX_UNLOCKED_SEASON이 없고 TEST_MODE=false이면 default=1 (프로덕션 안전 기본값)
 */

/**
 * 최대 잠금 해제된 시즌 번호 반환
 * @returns 1~99 사이의 시즌 번호
 */
export function getMaxUnlockedSeason(): number {
  const raw = process.env.MAX_UNLOCKED_SEASON;
  
  // 환경변수가 명시되면 최우선
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      // 1~99로 제한
      return Math.max(1, Math.min(99, parsed));
    }
  }
  
  // TEST_MODE이면 잠금 우회 (모든 시즌 허용)
  if (process.env.TEST_MODE === 'true') {
    return 99;
  }
  
  // 프로덕션 기본값: 시즌 1만 허용
  return 1;
}

/**
 * ID 문자열에서 시즌 번호 추출
 * @param id Room/Quest/Shop/Item ID
 * @returns 시즌 번호 (0=시즌 무관, 1~99=해당 시즌)
 */
export function parseSeasonFromId(id: string): number {
  if (!id) return 0;
  
  // Room: R{n}_* (예: R1_00=1, R2_BOSS_TOME=2)
  const roomMatch = id.match(/^R(\d+)_/);
  if (roomMatch) {
    return parseInt(roomMatch[1], 10);
  }
  
  // Quest: Q_S{nn}_* 또는 Q_S{n}_* (예: Q_S02_001=2, Q_S1_D01=1)
  const questMatch = id.match(/^Q_S0*(\d{1,2})_/);
  if (questMatch) {
    return parseInt(questMatch[1], 10);
  }
  
  // Shop: SHOP_S{n}* (예: SHOP_S2_BOSS_TROPHY_EXCHANGE=2, SHOP_S1*=1)
  const shopMatch = id.match(/^SHOP_S(\d{1,2})/);
  if (shopMatch) {
    return parseInt(shopMatch[1], 10);
  }
  
  // Item: *_S{nn} 또는 *_S{n} (예: ITEM_TROPHY_BOSS_S02=2, ITEM_*_S1=1)
  const itemMatch = id.match(/_S0*(\d{1,2})$/);
  if (itemMatch) {
    return parseInt(itemMatch[1], 10);
  }
  
  // 시즌 패턴이 없으면 0 (시즌 무관, 항상 허용)
  // 예: GH_GATE, START_TOWN, ITEM_POTION_HP_S (포션은 시즌 무관)
  return 0;
}

/**
 * 주어진 ID가 현재 잠금 해제된 시즌인지 확인
 * @param id Room/Quest/Shop/Item ID
 * @param maxSeason 최대 잠금 해제 시즌 (기본값: 현재 설정)
 * @returns true=접근 가능, false=잠김
 */
export function isUnlockedId(id: string, maxSeason?: number): boolean {
  const max = maxSeason ?? getMaxUnlockedSeason();
  const season = parseSeasonFromId(id);
  
  // 시즌 무관(0) 또는 잠금 해제된 시즌이면 허용
  return season === 0 || season <= max;
}

/**
 * 시즌 잠금 메시지 생성
 * @param season 잠긴 시즌 번호
 * @returns 사용자 친화적 메시지
 */
export function getSeasonLockedMessage(season: number): string {
  return `시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`;
}

