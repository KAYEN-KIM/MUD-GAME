export interface ShopCostItem {
  itemId: string;
  qty: number;
}

export interface ShopEntry {
  itemId: string;
  priceGold?: number;
  costItems?: ShopCostItem[];
}

export interface ShopDef {
  id: string;
  roomId: string;
  title: string;
  items: ShopEntry[];
}

