// 거래 시스템

export interface TradeOffer {
  offerId: string;
  fromCharacterId: string;
  toCharacterId: string;
  offeredItems: { itemId: string; qty: number }[];
  offeredGold: number;
  requestedItems: { itemId: string; qty: number }[];
  requestedGold: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: Date;
  expiresAt: Date;
}

const activeTrades = new Map<string, TradeOffer>();

export function createTradeOffer(
  fromCharacterId: string,
  toCharacterId: string,
  offeredItems: { itemId: string; qty: number }[],
  offeredGold: number,
  requestedItems: { itemId: string; qty: number }[],
  requestedGold: number,
): TradeOffer {
  const offerId = `trade_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const offer: TradeOffer = {
    offerId,
    fromCharacterId,
    toCharacterId,
    offeredItems,
    offeredGold,
    requestedItems,
    requestedGold,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분
  };

  activeTrades.set(offerId, offer);
  return offer;
}

export function getTradeOffer(offerId: string): TradeOffer | undefined {
  return activeTrades.get(offerId);
}

export function acceptTradeOffer(offerId: string): TradeOffer {
  const offer = activeTrades.get(offerId);
  if (!offer) {
    throw new Error('Trade offer not found');
  }
  if (offer.status !== 'PENDING') {
    throw new Error('Trade offer is not pending');
  }
  offer.status = 'ACCEPTED';
  return offer;
}

export function rejectTradeOffer(offerId: string): void {
  const offer = activeTrades.get(offerId);
  if (!offer) {
    throw new Error('Trade offer not found');
  }
  offer.status = 'REJECTED';
  activeTrades.delete(offerId);
}

export function cancelTradeOffer(offerId: string): void {
  const offer = activeTrades.get(offerId);
  if (!offer) {
    throw new Error('Trade offer not found');
  }
  offer.status = 'CANCELLED';
  activeTrades.delete(offerId);
}

export function getActiveTradesForCharacter(characterId: string): TradeOffer[] {
  return [...activeTrades.values()].filter(
    (offer) =>
      (offer.fromCharacterId === characterId || offer.toCharacterId === characterId) &&
      offer.status === 'PENDING',
  );
}

// 만료된 거래 정리
setInterval(() => {
  const now = new Date();
  for (const [offerId, offer] of activeTrades.entries()) {
    if (offer.expiresAt < now) {
      activeTrades.delete(offerId);
    }
  }
}, 60000); // 1분마다 정리

