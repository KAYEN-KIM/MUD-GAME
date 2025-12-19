// Quest 타입 정의 (MVP)

export type ObjectiveType = 
  | 'VISIT_ROOM'
  | 'KILL_IN_ZONE'
  | 'KILL_ANY'
  | 'COLLECT_ITEM'
  | 'KILL_BOSS';  // 시즌 2+ 보스 퀘스트용

export interface QuestObjective {
  type: ObjectiveType;
  roomId?: string;       // VISIT_ROOM
  zoneId?: string;       // KILL_IN_ZONE
  itemId?: string;       // COLLECT_ITEM
  bossId?: string;       // KILL_BOSS
  monsterId?: string;    // KILL_SPECIFIC
  count: number;
  requireBoss?: boolean; // KILL_IN_ZONE에서 보스만 카운트할지 여부
}

export interface QuestReward {
  gold?: number;
  exp?: number;
  items?: Array<{
    itemId: string;
    qty: number;
  }>;
}

export interface QuestProgress {
  [key: string]: number; // objectiveIndex -> currentCount
}

export interface QuestTemplateSummary {
  questId: string;
  title: string;
  description: string;
  minLevel: number;
  giverRoomId: string;
  turninRoomId: string;
  repeatable: boolean;
  cadence?: 'DAILY' | 'WEEKLY' | 'META' | 'STORY';
}

export interface QuestProgressSummary {
  questId: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TURNED_IN';
  progressSummary: string; // e.g. "2/3"
  objectives: QuestObjective[];
  progress: QuestProgress;
  giverRoomId: string;
  turninRoomId: string;
  repeatable: boolean;
  cadence?: 'DAILY' | 'WEEKLY' | 'META' | 'STORY';
}

export interface QuestTrackResult {
  changed: boolean;
  active: QuestProgressSummary[];
  completedIds: string[];
}

