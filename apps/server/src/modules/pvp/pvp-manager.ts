// PvP 대결장 시스템

export interface PvPMatch {
  matchId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  winnerId?: string;
  startedAt: Date;
  completedAt?: Date;
  wagerGold: number;
}

const activeMatches = new Map<string, PvPMatch>();

export function createPvPMatch(
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string,
  wagerGold: number = 0,
): PvPMatch {
  const matchId = `pvp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const match: PvPMatch = {
    matchId,
    player1Id,
    player1Name,
    player2Id,
    player2Name,
    status: 'WAITING',
    startedAt: new Date(),
    wagerGold,
  };

  activeMatches.set(matchId, match);
  return match;
}

export function startPvPMatch(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) throw new Error('Match not found');
  match.status = 'IN_PROGRESS';
}

export function completePvPMatch(matchId: string, winnerId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) throw new Error('Match not found');
  match.status = 'COMPLETED';
  match.winnerId = winnerId;
  match.completedAt = new Date();
}

export function getPvPMatch(matchId: string): PvPMatch | undefined {
  return activeMatches.get(matchId);
}

export function getActiveMatches(): PvPMatch[] {
  return [...activeMatches.values()].filter((m) => m.status !== 'COMPLETED');
}

