import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface ItemDropTable {
  itemId: string;
  chance: number; // 0-100
  minQty: number;
  maxQty: number;
}

const MONSTER_DROP_TABLES: Record<string, ItemDropTable[]> = {
  MON_RAT: [
    { itemId: 'ITEM_MAT_LEATHER', chance: 20, minQty: 1, maxQty: 2 },
    { itemId: 'ITEM_POTION_HP_S', chance: 10, minQty: 1, maxQty: 1 },
  ],
  MON_GOBLIN: [
    { itemId: 'ITEM_MAT_IRON_ORE', chance: 15, minQty: 1, maxQty: 3 },
    { itemId: 'ITEM_POTION_HP_S', chance: 20, minQty: 1, maxQty: 2 },
    { itemId: 'ITEM_SWORD_IRON', chance: 3, minQty: 1, maxQty: 1 },
  ],
  MON_WOLF: [
    { itemId: 'ITEM_MAT_LEATHER', chance: 40, minQty: 2, maxQty: 4 },
    { itemId: 'ITEM_POTION_HP_M', chance: 15, minQty: 1, maxQty: 1 },
  ],
  MON_ORC: [
    { itemId: 'ITEM_MAT_IRON_ORE', chance: 30, minQty: 3, maxQty: 5 },
    { itemId: 'ITEM_ARMOR_LEATHER', chance: 5, minQty: 1, maxQty: 1 },
    { itemId: 'ITEM_POTION_HP_M', chance: 20, minQty: 1, maxQty: 2 },
  ],
  MON_SKELETON: [
    { itemId: 'ITEM_MAT_BONE', chance: 50, minQty: 2, maxQty: 5 },
    { itemId: 'ITEM_POTION_MP_S', chance: 15, minQty: 1, maxQty: 1 },
  ],
  MON_VAMPIRE: [
    { itemId: 'ITEM_MAT_BLOOD_CRYSTAL', chance: 20, minQty: 1, maxQty: 2 },
    { itemId: 'ITEM_SWORD_MITHRIL', chance: 8, minQty: 1, maxQty: 1 },
    { itemId: 'ITEM_ELIXIR', chance: 10, minQty: 1, maxQty: 1 },
  ],
  MON_DRAGON: [
    { itemId: 'ITEM_MAT_DRAGON_SCALE', chance: 80, minQty: 5, maxQty: 10 },
    { itemId: 'ITEM_SWORD_MITHRIL', chance: 30, minQty: 1, maxQty: 1 },
    { itemId: 'ITEM_ARMOR_PLATE', chance: 30, minQty: 1, maxQty: 1 },
    { itemId: 'ITEM_ELIXIR', chance: 50, minQty: 2, maxQty: 5 },
  ],
};

@Injectable()
export class ItemDropService {
  constructor(private readonly prisma: PrismaService) {}

  async rollDrops(
    monsterId: string,
    characterId: string,
    dropRateBonus: number = 0,
  ): Promise<{ itemId: string; qty: number }[]> {
    const dropTable = MONSTER_DROP_TABLES[monsterId] || [];
    const drops: { itemId: string; qty: number }[] = [];

    for (const entry of dropTable) {
      const adjustedChance = Math.min(100, entry.chance * (1 + dropRateBonus / 100));
      const roll = Math.random() * 100;

      if (roll < adjustedChance) {
        const qty = Math.floor(
          Math.random() * (entry.maxQty - entry.minQty + 1) + entry.minQty,
        );
        drops.push({ itemId: entry.itemId, qty });
      }
    }

    return drops;
  }

  async giveDropsToCharacter(
    characterId: string,
    drops: { itemId: string; qty: number }[],
  ): Promise<void> {
    for (const drop of drops) {
      await this.prisma.inventory.upsert({
        where: {
          characterId_itemId: {
            characterId,
            itemId: drop.itemId,
          },
        },
        update: {
          qty: { increment: drop.qty },
        },
        create: {
          characterId,
          itemId: drop.itemId,
          qty: drop.qty,
        },
      });
    }
  }
}

