// 제작 시스템 (크래프팅)

export interface CraftingRecipe {
  id: string;
  name: string;
  resultItemId: string;
  resultQty: number;
  ingredients: { itemId: string; qty: number }[];
  requiredLevel: number;
  requiredSkill?: string;
  requiredSkillLevel?: number;
  craftTime: number; // milliseconds
  expGained: number;
}

const RECIPES: Record<string, CraftingRecipe> = {
  craft_iron_sword: {
    id: 'craft_iron_sword',
    name: '철제 검 제작',
    resultItemId: 'ITEM_SWORD_IRON',
    resultQty: 1,
    ingredients: [
      { itemId: 'ITEM_MAT_ORE_IRON', qty: 6 },
      { itemId: 'ITEM_MAT_LEATHER', qty: 2 },
    ],
    requiredLevel: 5,
    craftTime: 5000,
    expGained: 50,
  },
  craft_leather_armor: {
    id: 'craft_leather_armor',
    name: '가죽 갑옷 제작',
    resultItemId: 'ITEM_ARMOR_LEATHER',
    resultQty: 1,
    ingredients: [
      { itemId: 'ITEM_MAT_LEATHER', qty: 10 },
      { itemId: 'ITEM_MAT_ORE_IRON', qty: 2 },
    ],
    requiredLevel: 3,
    craftTime: 4000,
    expGained: 30,
  },
  craft_health_potion: {
    id: 'craft_health_potion',
    name: '체력 포션 제작',
    resultItemId: 'ITEM_POTION_HP_S',
    resultQty: 2,
    ingredients: [
      { itemId: 'ITEM_MAT_ORE_IRON', qty: 1 },
      { itemId: 'ITEM_MAT_LEATHER', qty: 1 },
    ],
    requiredLevel: 1,
    craftTime: 3000,
    expGained: 20,
  },
  craft_mana_potion: {
    id: 'craft_mana_potion',
    name: '마나 포션 제작',
    resultItemId: 'ITEM_MP_POTION',
    resultQty: 2,
    ingredients: [
      { itemId: 'ITEM_MAT_ORE_IRON', qty: 1 },
      { itemId: 'ITEM_MAT_LEATHER', qty: 1 },
    ],
    requiredLevel: 2,
    craftTime: 3500,
    expGained: 25,
  },
  craft_mithril_sword: {
    id: 'craft_mithril_sword',
    name: '미스릴 검 제작',
    resultItemId: 'ITEM_SWORD_MITHRIL',
    resultQty: 1,
    ingredients: [
      { itemId: 'ITEM_MAT_ORE_IRON', qty: 25 },
      { itemId: 'ITEM_MAT_DRAGON_SCALE', qty: 1 },
    ],
    requiredLevel: 15,
    craftTime: 10000,
    expGained: 200,
  },
};

export function getRecipe(recipeId: string): CraftingRecipe | undefined {
  return RECIPES[recipeId];
}

export function getAllRecipes(): CraftingRecipe[] {
  return Object.values(RECIPES);
}

export function getAvailableRecipes(characterLevel: number): CraftingRecipe[] {
  return Object.values(RECIPES).filter((r) => r.requiredLevel <= characterLevel);
}

export function canCraft(
  recipe: CraftingRecipe,
  characterLevel: number,
  inventory: Map<string, number>,
): { canCraft: boolean; missingItems: string[] } {
  if (characterLevel < recipe.requiredLevel) {
    return { canCraft: false, missingItems: ['레벨 부족'] };
  }

  const missingItems: string[] = [];
  for (const ingredient of recipe.ingredients) {
    const available = inventory.get(ingredient.itemId) || 0;
    if (available < ingredient.qty) {
      missingItems.push(`${ingredient.itemId} (필요: ${ingredient.qty}, 보유: ${available})`);
    }
  }

  return { canCraft: missingItems.length === 0, missingItems };
}

