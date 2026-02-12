/// WebSocket 메시지 모델
class WSMessage {
  final String t;
  final String? reqId;
  final int ts;
  final Map<String, dynamic> p;

  WSMessage({
    required this.t,
    this.reqId,
    required this.ts,
    required this.p,
  });

  factory WSMessage.fromJson(Map<String, dynamic> json) {
    return WSMessage(
      t: json['t'] as String,
      reqId: json['reqId'] as String?,
      ts: json['ts'] as int,
      p: json['p'] as Map<String, dynamic>? ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      't': t,
      if (reqId != null) 'reqId': reqId,
      'ts': ts,
      'p': p,
    };
  }
}

/// 로그 엔트리
class LogEntry {
  final DateTime timestamp;
  final String type;
  final String content;
  final Map<String, dynamic>? rawData;

  LogEntry({
    required this.timestamp,
    required this.type,
    required this.content,
    this.rawData,
  });
}

/// 룸 출구 정보
class RoomExit {
  final String label;
  final String toRoomId;
  final String? dir;

  RoomExit({
    required this.label,
    required this.toRoomId,
    this.dir,
  });

  factory RoomExit.fromJson(Map<String, dynamic> json) {
    // 하위호환: toRoomId / to_room_id / toRoomID 등 시도
    String? toRoomIdValue;
    if (json['toRoomId'] != null) {
      toRoomIdValue = json['toRoomId'] as String?;
    } else if (json['to_room_id'] != null) {
      toRoomIdValue = json['to_room_id'] as String?;
    } else if (json['toRoomID'] != null) {
      toRoomIdValue = json['toRoomID'] as String?;
    } else if (json['roomId'] != null) {
      toRoomIdValue = json['roomId'] as String?;
    }
    
    return RoomExit(
      label: json['label'] as String? ?? json['name'] as String? ?? '알 수 없음',
      toRoomId: toRoomIdValue ?? '',
      dir: json['dir'] as String?,
    );
  }
}

/// 인벤토리 아이템
class InventoryItem {
  final String itemId;
  final String name;
  final String type;
  final String? slot;
  final int qty;
  final int atk;
  final int def;
  final int hpBonus;
  final int priceSell;

  InventoryItem({
    required this.itemId,
    required this.name,
    required this.type,
    this.slot,
    required this.qty,
    required this.atk,
    required this.def,
    required this.hpBonus,
    required this.priceSell,
  });

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    return InventoryItem(
      itemId: json['itemId'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      slot: json['slot'] as String?,
      qty: json['qty'] as int? ?? 1,
      atk: json['atk'] as int? ?? 0,
      def: json['def'] as int? ?? 0,
      hpBonus: json['hpBonus'] as int? ?? 0,
      priceSell: json['priceSell'] as int? ?? 0,
    );
  }
}

/// 장착된 장비
class EquippedItem {
  final String itemId;
  final String name;
  final int atk;
  final int def;
  final int hpBonus;

  EquippedItem({
    required this.itemId,
    required this.name,
    required this.atk,
    required this.def,
    required this.hpBonus,
  });

  factory EquippedItem.fromJson(Map<String, dynamic> json) {
    return EquippedItem(
      itemId: json['itemId'] as String,
      name: json['name'] as String,
      atk: json['atk'] as int? ?? 0,
      def: json['def'] as int? ?? 0,
      hpBonus: json['hpBonus'] as int? ?? 0,
    );
  }
}

/// 게임 상태
class GameState {
  String? characterName;
  String? characterId;
  String? roomId;
  String? partyId;
  String? encounterId;
  int? level;
  int? hp;
  int? hpMax;
  int? mp;
  int? mpMax;
  int? exp;
  int? gold;
  int? skillPoints; // 스킬 포인트 (SKILL_LEARN 등에 사용)
  String? currentTitle; // 표시용 현재 칭호 (업적 화면 등)
  List<String>? roomTags; // 현재 방의 태그 (SAFE 등)
  List<RoomExit>? exits; // 가능한 출구 목록
  Map<String, EquippedItem>? equipment; // 장착 장비
  Map<String, int>? equipmentBonus; // 장비 보너스 합계 {atk, def, hpBonus}
  List<InventoryItem>? inventory; // 인벤토리 (선택적, INVENTORY_LIST 응답)
  String? cosmeticIconItemId; // 장착한 코스메틱 아이콘
  String? cosmeticTitleItemId; // 장착한 코스메틱 칭호

  GameState({
    this.characterName,
    this.characterId,
    this.roomId,
    this.partyId,
    this.encounterId,
    this.level,
    this.hp,
    this.hpMax,
    this.mp,
    this.mpMax,
    this.exp,
    this.gold,
    this.skillPoints,
    this.currentTitle,
    this.roomTags,
    this.exits,
    this.equipment,
    this.equipmentBonus,
    this.inventory,
    this.cosmeticIconItemId,
    this.cosmeticTitleItemId,
  });

  void updateFromStateSync(Map<String, dynamic> data) {
    if (data['character'] != null || data['char'] != null) {
      final char = (data['character'] ?? data['char']) as Map<String, dynamic>;
      characterId = char['id'] as String?;
      characterName = char['name'] as String?;
      roomId = char['roomId'] as String?;
      level = char['level'] as int?;
      hp = char['hp'] as int?;
      hpMax = char['hpMax'] as int?;
      mp = char['mp'] as int?;
      mpMax = char['mpMax'] as int?;
      exp = char['exp'] as int?;
      gold = char['gold'] as int?;
      skillPoints = char['skillPoints'] as int? ?? skillPoints;
      currentTitle = char['currentTitle'] as String? ?? currentTitle;

      // roomTags 파싱
      if (char['roomTags'] != null) {
        roomTags = (char['roomTags'] as List).map((e) => e.toString()).toList();
      } else {
        roomTags = null;
      }

      // 코스메틱 파싱
      cosmeticIconItemId = char['cosmeticIconItemId'] as String?;
      cosmeticTitleItemId = char['cosmeticTitleItemId'] as String?;

      // 장비 보너스 파싱
      if (char['equipmentBonus'] != null) {
        final bonus = char['equipmentBonus'] as Map<String, dynamic>;
        equipmentBonus = {
          'atk': bonus['atk'] as int? ?? 0,
          'def': bonus['def'] as int? ?? 0,
          'hpBonus': bonus['hpBonus'] as int? ?? 0,
        };
      }
    }
    if (data['party'] != null) {
      final party = data['party'] as Map<String, dynamic>;
      partyId = party['id'] as String?;
    }
    if (data['encounter'] != null) {
      final encounter = data['encounter'] as Map<String, dynamic>;
      encounterId = encounter['id'] as String?;
    }

    // 장비 정보 파싱
    if (data['equipment'] != null) {
      final equipMap = data['equipment'] as Map<String, dynamic>;
      equipment = {};
      for (final entry in equipMap.entries) {
        if (entry.value != null) {
          equipment![entry.key] = EquippedItem.fromJson(entry.value as Map<String, dynamic>);
        }
      }
    }

    // 출구 정보 파싱 (하위호환: exits / availableExits / room.exits)
    List<dynamic>? exitsList;
    if (data['exits'] != null) {
      exitsList = data['exits'] as List?;
    } else if (data['availableExits'] != null) {
      exitsList = data['availableExits'] as List?;
    } else if (data['room'] != null) {
      final room = data['room'] as Map<String, dynamic>?;
      if (room != null && room['exits'] != null) {
        exitsList = room['exits'] as List?;
      }
    }
    
    if (exitsList != null && exitsList.isNotEmpty) {
      try {
        exits = exitsList.map((e) {
          if (e is Map<String, dynamic>) {
            return RoomExit.fromJson(e);
          }
          return null;
        }).whereType<RoomExit>().toList();
      } catch (e) {
        print('[GameState] exits 파싱 실패: $e');
        exits = null;
      }
    } else {
      exits = null;
    }
  }

  String getSummary() {
    final parts = <String>[];
    if (characterName != null) parts.add('캐릭터: $characterName');
    if (level != null) parts.add('Lv.$level');
    if (hp != null && hpMax != null) parts.add('HP: $hp/$hpMax');
    if (mp != null && mpMax != null) parts.add('MP: $mp/$mpMax');
    if (roomId != null) parts.add('룸: $roomId');
    
    final pid = partyId;
    if (pid != null) {
      parts.add('파티: ${pid.length >= 8 ? pid.substring(0, 8) : pid}...');
    }
    
    if (encounterId != null) parts.add('전투중!');
    return parts.isEmpty ? '상태 없음' : parts.join(' | ');
  }

  /// 인벤토리에서 특정 아이템의 수량 조회
  int getItemQty(String itemId) {
    if (inventory == null) return 0;
    try {
      final item = inventory!.firstWhere((i) => i.itemId == itemId);
      return item.qty;
    } catch (e) {
      return 0;
    }
  }

  /// 인벤토리에서 특정 아이템의 이름 조회
  String? getItemName(String itemId) {
    if (inventory == null) return null;
    try {
      final item = inventory!.firstWhere((i) => i.itemId == itemId);
      return item.name;
    } catch (e) {
      return null;
    }
  }
}

/// 상점 비용 아이템 (인장 등)
class CostItem {
  final String itemId;
  final int qty;

  CostItem({
    required this.itemId,
    required this.qty,
  });

  factory CostItem.fromJson(Map<String, dynamic> json) {
    return CostItem(
      itemId: json['itemId'] as String,
      qty: json['qty'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'itemId': itemId,
      'qty': qty,
    };
  }
}

/// 상점 아이템 뷰
class ShopItemView {
  final String itemId;
  final String name;
  final int priceGold;
  final List<CostItem> costItems;

  ShopItemView({
    required this.itemId,
    required this.name,
    this.priceGold = 0,
    this.costItems = const [],
  });

  factory ShopItemView.fromJson(Map<String, dynamic> json) {
    final costItemsJson = json['costItems'] as List?;
    final costItems = costItemsJson != null
        ? costItemsJson.map((e) => CostItem.fromJson(e as Map<String, dynamic>)).toList()
        : <CostItem>[];

    return ShopItemView(
      itemId: json['itemId'] as String,
      name: json['itemName'] as String? ?? json['name'] as String? ?? json['itemId'] as String,
      priceGold: json['priceGold'] as int? ?? 0,
      costItems: costItems,
    );
  }

  /// 골드 상점 아이템인지 확인
  bool get isGoldShop => priceGold > 0 && costItems.isEmpty;

  /// 아이템 화폐 상점인지 확인
  bool get isCostItemShop => costItems.isNotEmpty;

  /// 가격 표시 문자열
  String getPriceText() {
    if (isGoldShop) {
      return '${priceGold}G';
    } else if (isCostItemShop) {
      return costItems.map((c) => '${c.itemId} x${c.qty}').join(', ');
    }
    return '가격 정보 없음';
  }
}

/// 상점 뷰
class ShopView {
  final String shopId;
  final String title;
  final String roomId;
  final List<ShopItemView> items;

  ShopView({
    required this.shopId,
    required this.title,
    this.roomId = '',
    required this.items,
  });

  factory ShopView.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List?;
    final items = itemsJson != null
        ? itemsJson.map((e) => ShopItemView.fromJson(e as Map<String, dynamic>)).toList()
        : <ShopItemView>[];

    return ShopView(
      shopId: json['shopId'] as String? ?? json['id'] as String? ?? 'UNKNOWN',
      title: json['title'] as String? ?? '상점',
      roomId: json['roomId'] as String? ?? '',
      items: items,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'shopId': shopId,
      'title': title,
      'roomId': roomId,
      'items': items.map((i) => {
        'itemId': i.itemId,
        'name': i.name,
        'priceGold': i.priceGold,
        'costItems': i.costItems.map((c) => c.toJson()).toList(),
      }).toList(),
    };
  }
}
