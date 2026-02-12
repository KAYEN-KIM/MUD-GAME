// 업적/칭호 시스템

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'COMBAT' | 'EXPLORATION' | 'CRAFTING' | 'SOCIAL' | 'SPECIAL';
  condition: {
    type:
      | 'KILL_MONSTERS'
      | 'REACH_LEVEL'
      | 'COMPLETE_QUESTS'
      | 'CRAFT_ITEMS'
      | 'ENHANCE_ITEM'
      | 'EARN_GOLD'
      | 'JOIN_GUILD'
      | 'WIN_PVP'
      | 'VISIT_ROOMS';
    target: number;
  };
  rewards: {
    title?: string;
    gold?: number;
    exp?: number;
    item?: { itemId: string; qty: number };
  };
  hidden: boolean;
}

const ACHIEVEMENTS: Record<string, Achievement> = {
  first_blood: {
    id: 'first_blood',
    name: '첫 전투',
    description: '첫 몬스터를 처치하세요.',
    category: 'COMBAT',
    condition: { type: 'KILL_MONSTERS', target: 1 },
    rewards: { title: '신참 모험가', gold: 100, exp: 50 },
    hidden: false,
  },
  monster_hunter: {
    id: 'monster_hunter',
    name: '몬스터 사냥꾼',
    description: '100마리의 몬스터를 처치하세요.',
    category: 'COMBAT',
    condition: { type: 'KILL_MONSTERS', target: 100 },
    rewards: { title: '사냥꾼', gold: 5000, exp: 1000 },
    hidden: false,
  },
  monster_slayer: {
    id: 'monster_slayer',
    name: '몬스터 학살자',
    description: '1000마리의 몬스터를 처치하세요.',
    category: 'COMBAT',
    condition: { type: 'KILL_MONSTERS', target: 1000 },
    rewards: { title: '학살자', gold: 50000, exp: 10000 },
    hidden: false,
  },
  novice: {
    id: 'novice',
    name: '초보 모험가',
    description: '레벨 10에 도달하세요.',
    category: 'EXPLORATION',
    condition: { type: 'REACH_LEVEL', target: 10 },
    rewards: { title: '초보자', gold: 1000, exp: 500 },
    hidden: false,
  },
  veteran: {
    id: 'veteran',
    name: '베테랑 모험가',
    description: '레벨 50에 도달하세요.',
    category: 'EXPLORATION',
    condition: { type: 'REACH_LEVEL', target: 50 },
    rewards: { title: '베테랑', gold: 100000, exp: 50000 },
    hidden: false,
  },
  quest_master: {
    id: 'quest_master',
    name: '퀘스트 마스터',
    description: '50개의 퀘스트를 완료하세요.',
    category: 'EXPLORATION',
    condition: { type: 'COMPLETE_QUESTS', target: 50 },
    rewards: { title: '퀘스트 마스터', gold: 10000, exp: 5000 },
    hidden: false,
  },
  wanderer: {
    id: 'wanderer',
    name: '방랑자',
    description: '10개의 방을 방문하세요.',
    category: 'EXPLORATION',
    condition: { type: 'VISIT_ROOMS', target: 10 },
    rewards: { title: '방랑자', gold: 500, exp: 200 },
    hidden: false,
  },
  cartographer: {
    id: 'cartographer',
    name: '지도 제작자',
    description: '50개의 방을 방문하세요.',
    category: 'EXPLORATION',
    condition: { type: 'VISIT_ROOMS', target: 50 },
    rewards: { title: '지도 제작자', gold: 5000, exp: 1500 },
    hidden: false,
  },
  master_craftsman: {
    id: 'master_craftsman',
    name: '장인',
    description: '100개의 아이템을 제작하세요.',
    category: 'CRAFTING',
    condition: { type: 'CRAFT_ITEMS', target: 100 },
    rewards: { title: '장인', gold: 20000, exp: 10000 },
    hidden: false,
  },
  enhancer: {
    id: 'enhancer',
    name: '강화의 달인',
    description: '장비를 +10까지 강화하세요.',
    category: 'CRAFTING',
    condition: { type: 'ENHANCE_ITEM', target: 10 },
    rewards: { title: '강화의 달인', gold: 50000, exp: 25000 },
    hidden: false,
  },
  rich: {
    id: 'rich',
    name: '부자',
    description: '100,000 골드를 모으세요.',
    category: 'SPECIAL',
    condition: { type: 'EARN_GOLD', target: 100000 },
    rewards: { title: '부자', exp: 10000 },
    hidden: false,
  },
  guild_member: {
    id: 'guild_member',
    name: '길드원',
    description: '길드에 가입하세요.',
    category: 'SOCIAL',
    condition: { type: 'JOIN_GUILD', target: 1 },
    rewards: { title: '길드원', gold: 500, exp: 100 },
    hidden: false,
  },
  pvp_champion: {
    id: 'pvp_champion',
    name: 'PvP 챔피언',
    description: 'PvP에서 10승을 달성하세요.',
    category: 'COMBAT',
    condition: { type: 'WIN_PVP', target: 10 },
    rewards: { title: 'PvP 챔피언', gold: 20000, exp: 10000 },
    hidden: false,
  },
};

export interface CharacterProgress {
  characterId: string;
  achievementProgress: Map<string, number>; // achievementId -> progress
  completedAchievements: Set<string>;
  currentTitle?: string;
}

const characterProgressMap = new Map<string, CharacterProgress>();

export function getProgress(characterId: string): CharacterProgress {
  if (!characterProgressMap.has(characterId)) {
    characterProgressMap.set(characterId, {
      characterId,
      achievementProgress: new Map(),
      completedAchievements: new Set(),
    });
  }
  return characterProgressMap.get(characterId)!;
}

export function updateProgress(characterId: string, type: Achievement['condition']['type'], amount: number = 1): Achievement[] {
  const progress = getProgress(characterId);
  const unlocked: Achievement[] = [];

  for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (progress.completedAchievements.has(achievementId)) continue;
    if (achievement.condition.type !== type) continue;

    const currentProgress = progress.achievementProgress.get(achievementId) || 0;
    const newProgress = currentProgress + amount;
    progress.achievementProgress.set(achievementId, newProgress);

    if (newProgress >= achievement.condition.target) {
      progress.completedAchievements.add(achievementId);
      unlocked.push(achievement);
    }
  }

  return unlocked;
}

export function getAllAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS);
}

export function getAchievement(achievementId: string): Achievement | undefined {
  return ACHIEVEMENTS[achievementId];
}

export function setTitle(characterId: string, title: string): void {
  const progress = getProgress(characterId);
  progress.currentTitle = title;
}

