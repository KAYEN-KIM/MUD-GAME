import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QuestService } from '../quest/quest.service';
import { QuestTrackResult } from '../quest/quest.types';
import { ShopDef, ShopEntry } from './shop.types';
import * as fs from 'fs';
import * as path from 'path';
import { getMaxUnlockedSeason, isUnlockedId } from '../../utils/season_lock';

interface ShopBuyResult {
  success: boolean;
  itemId: string;
  qty: number;
  cost: {
    gold: number;
    costItems: Array<{ itemId: string; qty: number }>;
  };
  granted: Array<{ itemId: string; qty: number }>;
  balances: {
    gold: number;
  };
  questResult: QuestTrackResult;
}

interface IdempotencyCacheEntry {
  result: ShopBuyResult;
  timestamp: number;
}

@Injectable()
export class ShopService {
  private shops: ShopDef[] = [];
  // 캐릭터 단위 mutex (동시 구매 방지)
  private characterLocks = new Map<string, Promise<any>>();
  // (characterId, reqId) idempotency 캐시
  private idempotencyCache = new Map<string, IdempotencyCacheEntry>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10분
  private readonly MAX_CACHE_SIZE = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly questService: QuestService,
  ) {
    this.loadShops();
    // 주기적 캐시 정리 (5분마다)
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
  }

  /**
   * 캐시 정리 (TTL 초과 항목 제거)
   */
  private cleanupCache() {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.idempotencyCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      this.idempotencyCache.delete(key);
    }
    
    // 크기 제한 (LRU 간소화: 가장 오래된 것부터 제거)
    if (this.idempotencyCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.idempotencyCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const removeCount = this.idempotencyCache.size - this.MAX_CACHE_SIZE;
      for (let i = 0; i < removeCount; i++) {
        this.idempotencyCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * content/shops.json 로드
   */
  private loadShops() {
    try {
      const shopsJsonPath = path.join(process.cwd(), 'content', 'shops.json');
      if (fs.existsSync(shopsJsonPath)) {
        const shopsData = fs.readFileSync(shopsJsonPath, 'utf-8');
        this.shops = JSON.parse(shopsData);
        console.log(`[ShopService] ${this.shops.length}개 상점 로드 완료`);
      } else {
        console.warn('[ShopService] content/shops.json을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('[ShopService] shops.json 로드 실패:', error);
    }
  }

  /**
   * roomId로 상점 조회
   */
  getShopByRoom(roomId: string): ShopDef | null {
    return this.shops.find((shop) => shop.roomId === roomId) || null;
  }

  /**
   * 상점 목록 반환 (시즌 잠금 필터링)
   */
  listShop(roomId: string): ShopDef | null {
    const shop = this.getShopByRoom(roomId);
    if (!shop) return null;
    
    // 시즌 잠금: 잠긴 시즌 상점 숨김
    const maxSeason = getMaxUnlockedSeason();
    if (!isUnlockedId(shop.id, maxSeason)) {
      return null;
    }
    
    // 상점 아이템도 시즌 잠금 필터링
    const filteredItems = shop.items.filter(item => isUnlockedId(item.itemId, maxSeason));
    
    return {
      ...shop,
      items: filteredItems,
    };
  }

  /**
   * 아이템 구매 (idempotent + mutex)
   */
  async buyItem(
    characterId: string,
    roomId: string,
    itemId: string,
    reqId?: string,
  ): Promise<ShopBuyResult> {
    // reqId 기반 idempotency 체크
    if (reqId) {
      const cacheKey = `${characterId}:${reqId}`;
      const cached = this.idempotencyCache.get(cacheKey);
      if (cached) {
        console.log(`[ShopService] Idempotency cache hit: ${cacheKey}`);
        return cached.result;
      }
    }

    // 캐릭터 단위 mutex (동시 구매 방지)
    const lockKey = characterId;
    const existingLock = this.characterLocks.get(lockKey);
    
    if (existingLock) {
      // 이미 진행 중인 구매가 있으면 대기
      await existingLock;
    }

    // 새로운 구매 시작
    const buyPromise = this.executeBuy(characterId, roomId, itemId);
    this.characterLocks.set(lockKey, buyPromise);

    try {
      const result = await buyPromise;
      
      // 결과 캐싱 (reqId가 있는 경우에만)
      if (reqId) {
        const cacheKey = `${characterId}:${reqId}`;
        this.idempotencyCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }
      
      return result;
    } finally {
      // Lock 해제
      this.characterLocks.delete(lockKey);
    }
  }

  /**
   * 실제 구매 로직 (트랜잭션)
   */
  private async executeBuy(
    characterId: string,
    roomId: string,
    itemId: string,
  ): Promise<ShopBuyResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. 현재 방에 상점이 있는지 확인
      const shop = this.getShopByRoom(roomId);
      if (!shop) {
        throw new Error('이 방에서는 상점을 이용할 수 없습니다.');
      }
      
      // 시즌 잠금: 잠긴 시즌 상점 차단
      const maxSeason = getMaxUnlockedSeason();
      if (!isUnlockedId(shop.id, maxSeason)) {
        const { parseSeasonFromId } = require('../../utils/season_lock');
        const season = parseSeasonFromId(shop.id);
        throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
      }

      // 2. 상점에서 아이템 찾기
      const shopEntry = shop.items.find((entry) => entry.itemId === itemId);
      if (!shopEntry) {
        throw new Error('상점에서 해당 아이템을 찾을 수 없습니다.');
      }
      
      // 시즌 잠금: 잠긴 시즌 아이템 구매 차단
      if (!isUnlockedId(itemId, maxSeason)) {
        const { parseSeasonFromId } = require('../../utils/season_lock');
        const season = parseSeasonFromId(itemId);
        throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
      }

      // 3. 캐릭터 조회
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });
      if (!character) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      // 비용 계산
      const cost = {
        gold: shopEntry.priceGold || 0,
        costItems: shopEntry.costItems || [],
      };

      // 4. 골드 결제 (priceGold가 있으면)
      if (cost.gold > 0) {
        if (character.gold < cost.gold) {
          throw new Error(
            `골드가 부족합니다. (필요: ${cost.gold}, 보유: ${character.gold})`,
          );
        }
        await tx.character.update({
          where: { id: characterId },
          data: { gold: character.gold - cost.gold },
        });
      }

      // 5. 아이템 화폐 결제 (costItems가 있으면)
      if (cost.costItems.length > 0) {
        for (const costItem of cost.costItems) {
          const inventory = await tx.inventory.findUnique({
            where: {
              characterId_itemId: { characterId, itemId: costItem.itemId },
            },
          });

          if (!inventory || inventory.qty < costItem.qty) {
            const item = await tx.item.findUnique({ where: { id: costItem.itemId } });
            throw new Error(
              `${item?.name || costItem.itemId}이(가) 부족합니다. (필요: ${costItem.qty}, 보유: ${inventory?.qty || 0})`,
            );
          }

          // 아이템 차감
          const newQty = inventory.qty - costItem.qty;
          if (newQty <= 0) {
            await tx.inventory.delete({
              where: {
                characterId_itemId: { characterId, itemId: costItem.itemId },
              },
            });
          } else {
            await tx.inventory.update({
              where: {
                characterId_itemId: { characterId, itemId: costItem.itemId },
              },
              data: { qty: newQty },
            });
          }
        }
      }

      // 6. 구매 아이템 지급
      const existing = await tx.inventory.findUnique({
        where: {
          characterId_itemId: { characterId, itemId },
        },
      });

      if (existing) {
        await tx.inventory.update({
          where: {
            characterId_itemId: { characterId, itemId },
          },
          data: { qty: existing.qty + 1 },
        });
      } else {
        await tx.inventory.create({
          data: {
            characterId,
            itemId,
            qty: 1,
          },
        });
      }

      // 7. QuestService.onItemGained 호출 (퀘스트 진행도 업데이트)
      const questResult = await this.questService.onItemGained(characterId, itemId, 1);
      
      // 8. 최종 골드 조회
      const updatedCharacter = await tx.character.findUnique({
        where: { id: characterId },
        select: { gold: true },
      });

      // 결과 구성
      return {
        success: true,
        itemId,
        qty: 1,
        cost,
        granted: [{ itemId, qty: 1 }],
        balances: {
          gold: updatedCharacter?.gold || character.gold - cost.gold,
        },
        questResult,
      };
    });
  }
}

