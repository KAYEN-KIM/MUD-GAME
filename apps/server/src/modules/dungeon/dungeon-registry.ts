// 던전 시스템

export enum DungeonDifficulty {
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  HELL = 'HELL',
}

export interface DungeonTemplate {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  maxPartySize: number;
  recommendedLevel: number;
  bossMonsterId?: string;
  difficulties: DungeonDifficultyConfig[];
  rewards: DungeonRewards;
}

export interface DungeonDifficultyConfig {
  difficulty: DungeonDifficulty;
  monsterHpMultiplier: number; // 1.0 = 기본, 2.0 = 2배
  monsterAtkMultiplier: number;
  monsterDefMultiplier: number;
  rewardExpMultiplier: number;
  rewardGoldMultiplier: number;
  rewardDropRateBonus: number; // 드롭률 보너스 (%)
}

export interface DungeonRewards {
  baseExp: number;
  baseGold: number;
  guaranteedItems?: { itemId: string; qty: number }[];
  possibleDrops?: { itemId: string; chanceBp: number; minQty: number; maxQty: number }[];
}

const DUNGEONS: Record<string, DungeonTemplate> = {
  goblin_cave: {
    id: 'goblin_cave',
    name: '고블린 동굴',
    description: '고블린들이 집결한 위험한 동굴입니다.',
    minLevel: 3,
    maxPartySize: 4,
    recommendedLevel: 5,
    bossMonsterId: 'MON_GOBLIN_KING',
    difficulties: [
      {
        difficulty: DungeonDifficulty.NORMAL,
        monsterHpMultiplier: 1.0,
        monsterAtkMultiplier: 1.0,
        monsterDefMultiplier: 1.0,
        rewardExpMultiplier: 1.0,
        rewardGoldMultiplier: 1.0,
        rewardDropRateBonus: 0,
      },
      {
        difficulty: DungeonDifficulty.HARD,
        monsterHpMultiplier: 1.5,
        monsterAtkMultiplier: 1.3,
        monsterDefMultiplier: 1.2,
        rewardExpMultiplier: 1.5,
        rewardGoldMultiplier: 1.5,
        rewardDropRateBonus: 10,
      },
      {
        difficulty: DungeonDifficulty.HELL,
        monsterHpMultiplier: 2.5,
        monsterAtkMultiplier: 1.8,
        monsterDefMultiplier: 1.5,
        rewardExpMultiplier: 2.5,
        rewardGoldMultiplier: 2.0,
        rewardDropRateBonus: 25,
      },
    ],
    rewards: {
      baseExp: 500,
      baseGold: 200,
      guaranteedItems: [{ itemId: 'ITEM_POTION_HP_M', qty: 2 }],
      possibleDrops: [
        { itemId: 'ITEM_SWORD_IRON', chanceBp: 3000, minQty: 1, maxQty: 1 },
        { itemId: 'ITEM_ARMOR_LEATHER', chanceBp: 3000, minQty: 1, maxQty: 1 },
      ],
    },
  },
  undead_crypt: {
    id: 'undead_crypt',
    name: '언데드 묘지',
    description: '언데드가 배회하는 어두운 묘지입니다.',
    minLevel: 8,
    maxPartySize: 4,
    recommendedLevel: 10,
    bossMonsterId: 'MON_LICH',
    difficulties: [
      {
        difficulty: DungeonDifficulty.NORMAL,
        monsterHpMultiplier: 1.0,
        monsterAtkMultiplier: 1.0,
        monsterDefMultiplier: 1.0,
        rewardExpMultiplier: 1.0,
        rewardGoldMultiplier: 1.0,
        rewardDropRateBonus: 0,
      },
      {
        difficulty: DungeonDifficulty.HARD,
        monsterHpMultiplier: 1.5,
        monsterAtkMultiplier: 1.3,
        monsterDefMultiplier: 1.2,
        rewardExpMultiplier: 1.5,
        rewardGoldMultiplier: 1.5,
        rewardDropRateBonus: 10,
      },
      {
        difficulty: DungeonDifficulty.HELL,
        monsterHpMultiplier: 2.5,
        monsterAtkMultiplier: 1.8,
        monsterDefMultiplier: 1.5,
        rewardExpMultiplier: 2.5,
        rewardGoldMultiplier: 2.0,
        rewardDropRateBonus: 25,
      },
    ],
    rewards: {
      baseExp: 1000,
      baseGold: 400,
      guaranteedItems: [{ itemId: 'ITEM_POTION_HP_L', qty: 1 }],
      possibleDrops: [
        { itemId: 'ITEM_SWORD_MITHRIL', chanceBp: 2000, minQty: 1, maxQty: 1 },
        { itemId: 'ITEM_ARMOR_CHAIN', chanceBp: 2000, minQty: 1, maxQty: 1 },
      ],
    },
  },
  dragon_lair: {
    id: 'dragon_lair',
    name: '드래곤 둥지',
    description: '전설의 드래곤이 잠들어 있는 위험한 둥지입니다.',
    minLevel: 20,
    maxPartySize: 8,
    recommendedLevel: 25,
    bossMonsterId: 'MON_DRAGON',
    difficulties: [
      {
        difficulty: DungeonDifficulty.NORMAL,
        monsterHpMultiplier: 1.0,
        monsterAtkMultiplier: 1.0,
        monsterDefMultiplier: 1.0,
        rewardExpMultiplier: 1.0,
        rewardGoldMultiplier: 1.0,
        rewardDropRateBonus: 0,
      },
      {
        difficulty: DungeonDifficulty.HARD,
        monsterHpMultiplier: 1.8,
        monsterAtkMultiplier: 1.5,
        monsterDefMultiplier: 1.3,
        rewardExpMultiplier: 2.0,
        rewardGoldMultiplier: 2.0,
        rewardDropRateBonus: 15,
      },
      {
        difficulty: DungeonDifficulty.HELL,
        monsterHpMultiplier: 3.0,
        monsterAtkMultiplier: 2.2,
        monsterDefMultiplier: 1.8,
        rewardExpMultiplier: 3.5,
        rewardGoldMultiplier: 3.0,
        rewardDropRateBonus: 35,
      },
    ],
    rewards: {
      baseExp: 5000,
      baseGold: 2000,
      guaranteedItems: [
        { itemId: 'ITEM_ELIXIR', qty: 3 },
        { itemId: 'ITEM_MAT_DRAGON_SCALE', qty: 5 },
      ],
      possibleDrops: [
        { itemId: 'ITEM_SWORD_MITHRIL', chanceBp: 5000, minQty: 1, maxQty: 1 },
        { itemId: 'ITEM_ARMOR_PLATE', chanceBp: 5000, minQty: 1, maxQty: 1 },
        { itemId: 'ITEM_AMULET_HP', chanceBp: 3000, minQty: 1, maxQty: 1 },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Season 2~10 확장 던전/레이드 템플릿
  //
  // NOTE:
  // - 현재 던전 시스템은 “목록/입장” 중심으로 단계적 구현 중이라,
  //   스토리와의 정합을 위해 우선 템플릿을 추가한다.
  // - bossMonsterId는 추후 몬스터 시드/레지스트리 확장 시 실제 ID로 교체.
  // ---------------------------------------------------------------------------

  // Season 2: 염분의 왕관
  s2_sunken_lane: {
    id: 's2_sunken_lane',
    name: '침몰한 항로',
    description: '실종선의 잔해가 모인 해저 항로. 물이 아니라 기억이 흐른다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S2_SUNKEN_WARDEN',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.6, monsterAtkMultiplier: 1.3, monsterDefMultiplier: 1.2, rewardExpMultiplier: 1.4, rewardGoldMultiplier: 1.2, rewardDropRateBonus: 10 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.3, monsterAtkMultiplier: 1.6, monsterDefMultiplier: 1.4, rewardExpMultiplier: 1.9, rewardGoldMultiplier: 1.4, rewardDropRateBonus: 20 },
    ],
    rewards: {
      baseExp: 2500,
      baseGold: 2500,
      possibleDrops: [{ itemId: 'ITEM_MAT_ORE_IRON', chanceBp: 1500, minQty: 2, maxQty: 5 }],
    },
  },
  s2_wreck_auction: {
    id: 's2_wreck_auction',
    name: '난파선 경매장',
    description: '해적들이 난파선 잔해를 거래하는 지하 경매장. 지도 조각이 숨겨져 있다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S2_AUCTIONEER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.7, monsterAtkMultiplier: 1.35, monsterDefMultiplier: 1.2, rewardExpMultiplier: 1.45, rewardGoldMultiplier: 1.25, rewardDropRateBonus: 10 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.4, monsterAtkMultiplier: 1.65, monsterDefMultiplier: 1.45, rewardExpMultiplier: 2.0, rewardGoldMultiplier: 1.5, rewardDropRateBonus: 20 },
    ],
    rewards: { baseExp: 2800, baseGold: 3000 },
  },

  // Season 3: 철림 전쟁
  s3_outpost_collapse: {
    id: 's3_outpost_collapse',
    name: '전초기지 붕괴',
    description: '무너진 전초기지 지하. 악몽이 전장을 덮는다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S3_NIGHTMARE_ENGINE',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.8, monsterAtkMultiplier: 1.35, monsterDefMultiplier: 1.25, rewardExpMultiplier: 1.5, rewardGoldMultiplier: 1.2, rewardDropRateBonus: 10 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.6, monsterAtkMultiplier: 1.7, monsterDefMultiplier: 1.5, rewardExpMultiplier: 2.1, rewardGoldMultiplier: 1.4, rewardDropRateBonus: 20 },
    ],
    rewards: { baseExp: 3000, baseGold: 2600 },
  },
  s3_foundation_of_war: {
    id: 's3_foundation_of_war',
    name: '전쟁의 재단',
    description: '전쟁을 숫자로 바꾸는 장부의 던전. 관리의 얼굴이 드러난다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S3_LEDGER_GUARD',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.85, monsterAtkMultiplier: 1.4, monsterDefMultiplier: 1.25, rewardExpMultiplier: 1.55, rewardGoldMultiplier: 1.25, rewardDropRateBonus: 12 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.7, monsterAtkMultiplier: 1.75, monsterDefMultiplier: 1.55, rewardExpMultiplier: 2.15, rewardGoldMultiplier: 1.45, rewardDropRateBonus: 22 },
    ],
    rewards: { baseExp: 3300, baseGold: 3200 },
  },

  // Season 4: 망자의 회계
  s4_undercrypt_gatekeeper: {
    id: 's4_undercrypt_gatekeeper',
    name: '언더크립트의 문지기',
    description: '기록이 읽는 자를 기록하는 무덤 아래의 서고.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S4_GATEKEEPER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.9, monsterAtkMultiplier: 1.45, monsterDefMultiplier: 1.3, rewardExpMultiplier: 1.6, rewardGoldMultiplier: 1.25, rewardDropRateBonus: 12 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.8, monsterAtkMultiplier: 1.8, monsterDefMultiplier: 1.6, rewardExpMultiplier: 2.2, rewardGoldMultiplier: 1.5, rewardDropRateBonus: 25 },
    ],
    rewards: { baseExp: 3500, baseGold: 3500 },
  },
  s4_choir_of_dead: {
    id: 's4_choir_of_dead',
    name: '망자의 합창단',
    description: '숨 없는 합창이 문을 여는 리듬을 만든다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S4_CHOIRMASTER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 1.95, monsterAtkMultiplier: 1.5, monsterDefMultiplier: 1.35, rewardExpMultiplier: 1.65, rewardGoldMultiplier: 1.3, rewardDropRateBonus: 12 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 2.9, monsterAtkMultiplier: 1.85, monsterDefMultiplier: 1.65, rewardExpMultiplier: 2.25, rewardGoldMultiplier: 1.55, rewardDropRateBonus: 25 },
    ],
    rewards: { baseExp: 3800, baseGold: 3800 },
  },

  // Season 5: 하늘의 단조
  s5_aerial_smeltery: {
    id: 's5_aerial_smeltery',
    name: '공중 제련장',
    description: '바닥이 없는 제련장. 불꽃이 떨어지지 않고 떠오른다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S5_FORGE_HEART',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.0, monsterAtkMultiplier: 1.55, monsterDefMultiplier: 1.4, rewardExpMultiplier: 1.7, rewardGoldMultiplier: 1.35, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.0, monsterAtkMultiplier: 1.9, monsterDefMultiplier: 1.7, rewardExpMultiplier: 2.3, rewardGoldMultiplier: 1.6, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4000, baseGold: 4200 },
  },
  s5_skyforge_labyrinth: {
    id: 's5_skyforge_labyrinth',
    name: '천공의 대장간',
    description: '룬으로 짜인 미로. “완성된 장비”를 요구하는 문이 숨는다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S5_ANVIL_SENTINEL',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.05, monsterAtkMultiplier: 1.6, monsterDefMultiplier: 1.45, rewardExpMultiplier: 1.75, rewardGoldMultiplier: 1.4, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.1, monsterAtkMultiplier: 1.95, monsterDefMultiplier: 1.75, rewardExpMultiplier: 2.35, rewardGoldMultiplier: 1.65, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4200, baseGold: 4500 },
  },

  // Season 6: 거울바다
  s6_reverse_shore: {
    id: 's6_reverse_shore',
    name: '반전의 해안',
    description: '지도가 무력해지는 해안. 로그가 곧 길이 된다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S6_COMPASS_EATER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.1, monsterAtkMultiplier: 1.6, monsterDefMultiplier: 1.45, rewardExpMultiplier: 1.75, rewardGoldMultiplier: 1.35, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.2, monsterAtkMultiplier: 2.0, monsterDefMultiplier: 1.8, rewardExpMultiplier: 2.4, rewardGoldMultiplier: 1.6, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4300, baseGold: 4200 },
  },
  s6_mirror_abyss: {
    id: 's6_mirror_abyss',
    name: '거울심연',
    description: '공격은 반사되고, 치유는 독이 된다. 조합이 곧 퍼즐.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S6_REFLECTOR_CORE',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.15, monsterAtkMultiplier: 1.65, monsterDefMultiplier: 1.5, rewardExpMultiplier: 1.8, rewardGoldMultiplier: 1.4, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.25, monsterAtkMultiplier: 2.05, monsterDefMultiplier: 1.85, rewardExpMultiplier: 2.45, rewardGoldMultiplier: 1.65, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4500, baseGold: 4500 },
  },

  // Season 7: 투기장
  s7_arena_underworks: {
    id: 's7_arena_underworks',
    name: '투기장 하부',
    description: '승부조작의 증거가 숨겨진 하부 시설.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S7_FIXER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.2, monsterAtkMultiplier: 1.7, monsterDefMultiplier: 1.55, rewardExpMultiplier: 1.85, rewardGoldMultiplier: 1.45, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.3, monsterAtkMultiplier: 2.1, monsterDefMultiplier: 1.9, rewardExpMultiplier: 2.5, rewardGoldMultiplier: 1.7, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4600, baseGold: 4800 },
  },
  s7_apostle_hunting_ground: {
    id: 's7_apostle_hunting_ground',
    name: '사도의 사냥터',
    description: '약점과 공포를 비추는 심리 던전.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S7_APOSTLE_SHADE',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.25, monsterAtkMultiplier: 1.75, monsterDefMultiplier: 1.6, rewardExpMultiplier: 1.9, rewardGoldMultiplier: 1.5, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.35, monsterAtkMultiplier: 2.15, monsterDefMultiplier: 1.95, rewardExpMultiplier: 2.55, rewardGoldMultiplier: 1.75, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 4800, baseGold: 5200 },
  },

  // Season 8: 클록생텀
  s8_clocksanctum_anteroom: {
    id: 's8_clocksanctum_anteroom',
    name: '클록생텀 전실',
    description: '시간 퍼즐의 시작. 공략 공유가 시즌 문화가 된다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S8_GEAR_SENTINEL',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.3, monsterAtkMultiplier: 1.8, monsterDefMultiplier: 1.65, rewardExpMultiplier: 1.95, rewardGoldMultiplier: 1.5, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.4, monsterAtkMultiplier: 2.2, monsterDefMultiplier: 2.0, rewardExpMultiplier: 2.6, rewardGoldMultiplier: 1.75, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 5000, baseGold: 5200 },
  },
  s8_clockwork_abyss: {
    id: 's8_clockwork_abyss',
    name: '시계장치 심연',
    description: '루프를 통제하는 자만 통과한다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S8_LOOP_CORE',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.35, monsterAtkMultiplier: 1.85, monsterDefMultiplier: 1.7, rewardExpMultiplier: 2.0, rewardGoldMultiplier: 1.55, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.45, monsterAtkMultiplier: 2.25, monsterDefMultiplier: 2.05, rewardExpMultiplier: 2.65, rewardGoldMultiplier: 1.8, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 5200, baseGold: 5500 },
  },

  // Season 9: 폴른스타 크레이터
  s9_crater_outer_ring: {
    id: 's9_crater_outer_ring',
    name: '크레이터 외곽',
    description: '탐색/공유가 강제되는 변형 지형.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S9_PATH_BENDER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.4, monsterAtkMultiplier: 1.9, monsterDefMultiplier: 1.75, rewardExpMultiplier: 2.05, rewardGoldMultiplier: 1.6, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.55, monsterAtkMultiplier: 2.3, monsterDefMultiplier: 2.1, rewardExpMultiplier: 2.7, rewardGoldMultiplier: 1.85, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 5400, baseGold: 5600 },
  },
  s9_crater_core: {
    id: 's9_crater_core',
    name: '크레이터 심부',
    description: '중력이 비뚤어지고 전투 규칙이 흔들린다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S9_GRAVITY_CORE',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.45, monsterAtkMultiplier: 1.95, monsterDefMultiplier: 1.8, rewardExpMultiplier: 2.1, rewardGoldMultiplier: 1.65, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.6, monsterAtkMultiplier: 2.35, monsterDefMultiplier: 2.15, rewardExpMultiplier: 2.75, rewardGoldMultiplier: 1.9, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 5600, baseGold: 6000 },
  },

  // Season 10: 마지막 문
  s10_void_outpost: {
    id: 's10_void_outpost',
    name: '공허의 전초',
    description: '규칙이 붕괴하는 전초. 지금까지의 빌드가 시험대에 오른다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S10_RULEBREAKER',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.6, monsterAtkMultiplier: 2.05, monsterDefMultiplier: 1.9, rewardExpMultiplier: 2.2, rewardGoldMultiplier: 1.75, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.8, monsterAtkMultiplier: 2.45, monsterDefMultiplier: 2.25, rewardExpMultiplier: 2.9, rewardGoldMultiplier: 2.0, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 6000, baseGold: 6500 },
  },
  s10_corridor_of_nothing: {
    id: 's10_corridor_of_nothing',
    name: '무의 회랑',
    description: '보상이 없다. 오직 “남는 것”만 있다.',
    minLevel: 50,
    maxPartySize: 4,
    recommendedLevel: 50,
    bossMonsterId: 'MON_S10_EMPTY_WITNESS',
    difficulties: [
      { difficulty: DungeonDifficulty.NORMAL, monsterHpMultiplier: 1.0, monsterAtkMultiplier: 1.0, monsterDefMultiplier: 1.0, rewardExpMultiplier: 1.0, rewardGoldMultiplier: 1.0, rewardDropRateBonus: 0 },
      { difficulty: DungeonDifficulty.HARD, monsterHpMultiplier: 2.65, monsterAtkMultiplier: 2.1, monsterDefMultiplier: 1.95, rewardExpMultiplier: 2.25, rewardGoldMultiplier: 1.8, rewardDropRateBonus: 15 },
      { difficulty: DungeonDifficulty.HELL, monsterHpMultiplier: 3.85, monsterAtkMultiplier: 2.5, monsterDefMultiplier: 2.3, rewardExpMultiplier: 3.0, rewardGoldMultiplier: 2.05, rewardDropRateBonus: 30 },
    ],
    rewards: { baseExp: 6200, baseGold: 6800 },
  },
};

export function getDungeon(dungeonId: string): DungeonTemplate | null {
  return DUNGEONS[dungeonId] || null;
}

export function getAllDungeons(): DungeonTemplate[] {
  return Object.values(DUNGEONS);
}

export function getDungeonsByLevel(minLevel: number, maxLevel: number): DungeonTemplate[] {
  return Object.values(DUNGEONS).filter(
    (d) => d.minLevel >= minLevel && d.recommendedLevel <= maxLevel,
  );
}

