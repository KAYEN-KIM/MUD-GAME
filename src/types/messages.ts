// WebSocket 메시지 타입 정의

export type MessageType =
  // 인증
  | 'AUTH'
  | 'AUTH_OK'
  | 'AUTH_FAIL'
  // 기본 푸시
  | 'LOG_APPEND'
  | 'STATE_SYNC'
  | 'ERROR'
  // 파티
  | 'PARTY_CREATE'
  | 'PARTY_INVITE'
  | 'PARTY_JOIN'
  | 'PARTY_LEAVE'
  | 'PARTY_SET_LEADER'
  | 'PARTY_FOLLOW_SET'
  | 'PARTY_SPEED_SET'
  | 'PARTY_PRESET_SET'
  // 이동/사냥
  | 'MOVE'
  | 'HUNT'
  // 전투
  | 'ENCOUNTER_START'
  | 'COMBAT_TURN'
  | 'AUTO_SET'
  | 'COMBAT_TIMEBANK_USE'
  | 'COMBAT_RESOLVE'
  | 'COMBAT_END'
  // 채팅/신고
  | 'CHAT_SEND'
  | 'REPORT_CREATE';

export type ErrorCode = 'RATE_LIMIT' | 'NOT_FOUND' | 'INVALID_STATE' | 'FORBIDDEN';

export interface WSMessage {
  t: MessageType;
  reqId?: string;
  ts: number;
  p: any;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export interface AuthPayload {
  token: string;
}

export interface AuthOkPayload {
  characterId: string;
  characterName: string;
  currentRoomId: string;
}

export interface AuthFailPayload {
  reason: string;
}

export interface LogAppendPayload {
  text: string;
  type?: 'info' | 'combat' | 'chat' | 'system';
}

export interface StateSyncPayload {
  character?: {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    currentRoomId: string;
  };
  party?: {
    id: string;
    leaderId: string;
    speedMode: 'FAST' | 'TACTICAL';
    members: Array<{
      characterId: string;
      characterName: string;
      follow: boolean;
      preset: string;
    }>;
  };
  room?: {
    id: string;
    name: string;
    description: string;
    exits: Array<{
      direction: string;
      toRoomId: string;
    }>;
  };
  encounter?: {
    id: string;
    turnNumber: number;
    turnEndsAt: number;
    participants: Array<{
      id: string;
      name: string;
      isPlayer: boolean;
      hp: number;
      maxHp: number;
    }>;
  };
}

export interface MovePayload {
  direction: string;
}

export interface HuntPayload {
  // 빈 페이로드 또는 추가 옵션
}

export interface PartyCreatePayload {
  // 빈 페이로드
}

export interface PartyInvitePayload {
  characterName: string;
}

export interface PartyJoinPayload {
  partyId: string;
}

export interface PartyLeavePayload {
  // 빈 페이로드
}

export interface PartySetLeaderPayload {
  characterId: string;
}

export interface PartyFollowSetPayload {
  follow: boolean;
}

export interface PartySpeedSetPayload {
  speedMode: 'FAST' | 'TACTICAL';
}

export interface PartyPresetSetPayload {
  preset: 'AGGRO' | 'GUARD' | 'SAVER' | 'SUSTAIN' | 'SUPPORT' | 'RETREAT';
}

export interface CombatTurnPayload {
  action: string;
  targetId?: string;
}

export interface AutoSetPayload {
  enabled: boolean;
}

export interface ChatSendPayload {
  message: string;
  type?: 'ROOM' | 'PARTY' | 'GLOBAL';
}

export interface ReportCreatePayload {
  reportedCharacterId?: string;
  reportedMessageId?: string;
  reason: string;
}

