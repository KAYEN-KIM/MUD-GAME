export interface WSMessage {
  t: string;
  reqId?: string;
  ts: number;
  p: any;
}

export interface LogAppendPayload {
  scope: 'SYSTEM' | 'WORLD' | 'COMBAT' | 'CHAT';
  channel?: string;
  text: string;
  meta?: any;
}

export interface StateSyncPayload {
  char?: any;
  party?: any;
  encounter?: any;
  cooldowns?: any;
  uiHints?: any;
  exits?: Array<{
    label: string;
    toRoomId: string;
    dir: string | null;
  }>;
  inventory?: Array<{
    itemId: string;
    name: string;
    type: string;
    slot: string | null;
    qty: number;
    atk: number;
    def: number;
    hpBonus: number;
    priceSell: number;
  }>;
  equipment?: {
    [slot: string]: {
      itemId: string;
      name: string;
      atk: number;
      def: number;
      hpBonus: number;
    } | null;
  };
}

export interface ErrorPayload {
  code: 'RATE_LIMIT' | 'NOT_FOUND' | 'INVALID_STATE' | 'FORBIDDEN';
  message: string;
}

