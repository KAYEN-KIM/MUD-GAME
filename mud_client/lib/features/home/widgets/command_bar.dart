import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';

class CommandBar extends StatefulWidget {
  const CommandBar({super.key});

  @override
  State<CommandBar> createState() => _CommandBarState();
}

class _CommandBarState extends State<CommandBar> {
  final TextEditingController _controller = TextEditingController();

  String? _findInventoryItemId(SessionState session, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return null;
    final inv = session.gameState.inventory ?? [];
    if (inv.isEmpty) return null;

    // 1) itemId exact
    final exactId = inv.where((it) => it.itemId.toLowerCase() == q).toList();
    if (exactId.length == 1) return exactId.first.itemId;

    // 2) name exact
    final exactName = inv.where((it) => it.name.toLowerCase() == q).toList();
    if (exactName.length == 1) return exactName.first.itemId;

    // 3) name contains (first match)
    final partial = inv.where((it) => it.name.toLowerCase().contains(q)).toList();
    if (partial.length == 1) return partial.first.itemId;

    return null;
  }

  String? _findMonsterId(SessionState session, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return null;
    final monsters = session.roomMonsters;
    if (monsters.isEmpty) return null;

    // 1) id exact
    final idExact = monsters.where((m) => (m['id']?.toString().toLowerCase() ?? '') == q).toList();
    if (idExact.length == 1) return idExact.first['id']?.toString();

    // 2) name exact
    final nameExact = monsters.where((m) => (m['name']?.toString().toLowerCase() ?? '') == q).toList();
    if (nameExact.length == 1) return nameExact.first['id']?.toString();

    // 3) name contains (first match)
    final partial = monsters.where((m) => (m['name']?.toString().toLowerCase() ?? '').contains(q)).toList();
    if (partial.length == 1) return partial.first['id']?.toString();

    return null;
  }

  String _normalizeSlot(String raw) {
    final s = raw.trim().toLowerCase();
    const map = {
      'weapon': 'WEAPON',
      'wep': 'WEAPON',
      'head': 'HEAD',
      'helm': 'HEAD',
      'helmet': 'HEAD',
      'body': 'BODY',
      'chest': 'BODY',
      'legs': 'LEGS',
      'leg': 'LEGS',
      'boots': 'LEGS',
      'accessory': 'ACCESSORY',
      'acc': 'ACCESSORY',
      'ring': 'ACCESSORY',
      'neck': 'ACCESSORY',
      'amulet': 'ACCESSORY',
    };
    return map[s] ?? raw.trim().toUpperCase();
  }

  String? _findShopItemId(SessionState session, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return null;
    final shop = session.activeShop;
    if (shop == null) return null;

    final items = shop.items;
    // itemId exact
    final idExact = items.where((it) => it.itemId.toLowerCase() == q).toList();
    if (idExact.length == 1) return idExact.first.itemId;
    // name exact
    final nameExact = items.where((it) => it.name.toLowerCase() == q).toList();
    if (nameExact.length == 1) return nameExact.first.itemId;
    // name contains
    final partial = items.where((it) => it.name.toLowerCase().contains(q)).toList();
    if (partial.length == 1) return partial.first.itemId;
    return null;
  }

  String? _findNpcId(SessionState session, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return null;
    final npcs = session.npcs;
    if (npcs.isEmpty) return null;

    final idExact = npcs.where((n) => (n['id']?.toString().toLowerCase() ?? '') == q).toList();
    if (idExact.length == 1) return idExact.first['id']?.toString();

    final nameExact = npcs.where((n) => (n['name']?.toString().toLowerCase() ?? '') == q).toList();
    if (nameExact.length == 1) return nameExact.first['id']?.toString();

    final partial = npcs.where((n) => (n['name']?.toString().toLowerCase() ?? '').contains(q)).toList();
    if (partial.length == 1) return partial.first['id']?.toString();

    return null;
  }

  String? _findRoomItemId(SessionState session, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return null;
    final items = session.roomItems;
    if (items.isEmpty) return null;

    final idExact = items.where((it) => (it['itemId']?.toString().toLowerCase() ?? '') == q).toList();
    if (idExact.length == 1) return idExact.first['itemId']?.toString();

    final nameExact = items.where((it) => (it['name']?.toString().toLowerCase() ?? '') == q).toList();
    if (nameExact.length == 1) return nameExact.first['itemId']?.toString();

    final partial = items.where((it) => (it['name']?.toString().toLowerCase() ?? '').contains(q)).toList();
    if (partial.length == 1) return partial.first['itemId']?.toString();

    return null;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _runCommand(SessionState session, String input) {
    final raw = input.trim();
    if (raw.isEmpty) return;

    final lower = raw.toLowerCase();

    // 흔한 머드 단축 명령
    if (lower == 'l' || lower == 'look') {
      session.send('LOOK', {});
      return;
    }
    if (lower == 'h' || lower == 'help' || lower == '?') {
      session.addLog(
        '명령: look(l), exits, who, monsters, inv(i), eq, stats\n'
        '      n/s/e/w/u/d, say <text>\n'
        '      attack/kill <monster>, hunt, cast <spell> [target]\n'
        '      equip <item>, unequip <slot>, enhance <slot>, use <item> [qty]\n'
        '      loot/items, get all, drop all\n'
        '      search/scavenge, nodes, gather <nodeId>\n'
        '      guilds, guild create <name> [desc], guild join <id>, guild leave, g <text>\n'
        '      vault, vault deposit gold <amount>, vault withdraw gold <amount>\n'
        '      vault deposit <item> [qty], vault withdraw <item> [qty]\n'
        '      war list, war challenge <guildId>, war accept <warId>\n'
        '      war match <warId> <targetName>\n'
        '      gquest, gquest accept <questId>, gquest turnin <questId>\n'
        '      skills, skill learn <skillId>, skill use <skillId> [target]\n'
        '      dungeons, dungeon enter <dungeonId> [difficulty], dungeon status\n'
        '      raids, raid enter <raidId>, raid status\n'
        '      pets, pet summon <petId>, pet dismiss\n'
        '      house, house create <name>, house storage <deposit|withdraw> <item> [qty]\n'
        '      farm plant <plotIndex> <cropId>, farm harvest <plotIndex>\n'
        '      events, event join <eventId>, event progress <eventId> <progress>\n'
        '      ranking dungeon [dungeonId] [difficulty], ranking raid [raidId]\n'
        '      recipes, craft <recipeId>\n'
        '      ach, ach claim <achievementId>\n'
        '      trade <targetName> [gold], trade accept <offerId>, trade reject <offerId>\n'
        '      pvp challenge <name> [betGold], pvp accept <matchId>, pvp ranking\n'
        '      market, market list [itemId], market sell <item> <qty> <startPrice> [buyNowPrice]\n'
        '      market bid <listingId> <amount>, market buy <listingId>, market cancel <listingId>\n'
        '      roll [sides], coin\n'
        '      friends, friend add <name>, friend accept <requestId>, friend remove <friendId>\n'
        '      blacklist, blacklist add <name> [reason], blacklist remove <blockedId>\n'
        '      mail, mail send <toName> <subject> <content> [gold] [items], mail read <mailId>\n'
        '      mail claim <mailId>, mail delete <mailId>\n'
        '      bestiary, titles, title equip <titleId>, collectibles\n'
        '      bank, bank deposit <amount>, bank withdraw <amount>, bank history\n'
        '      exchange, exchange sell <item> <qty> <price>, exchange buy <listingId> [qty]\n'
        '      exchange cancel <listingId>\n'
        '팁: 접속/이동 시 자동으로 방 묘사가 출력됩니다.',
        'SYSTEM',
      );
      return;
    }
    if (lower == 'who') {
      session.send('WHO', {});
      return;
    }
    if (lower == 'exits') {
      session.send('EXITS', {});
      return;
    }
    if (lower == 'i' || lower == 'inv' || lower == 'inventory') {
      session.send('INVENTORY_LIST', {});
      return;
    }
    if (lower == 'eq' || lower == 'equipment') {
      session.send('EQUIPMENT_GET', {});
      return;
    }
    if (lower == 'monsters' || lower == 'mobs') {
      session.requestRoomMonsters();
      session.addLog('👹 몬스터 목록 조회 중...', 'SYSTEM');
      return;
    }
    if (lower == 'shop') {
      final shop = session.activeShop;
      if (shop == null) {
        session.send('SHOP_LIST', {});
        session.addLog('🏪 상점 조회 중... (상점 방이 아니면 실패할 수 있음)', 'SYSTEM');
        return;
      }
      if (shop.items.isEmpty) {
        session.addLog('🏪 상점: 아이템 없음', 'SYSTEM');
        return;
      }
      final lines = <String>['🏪 ${shop.title} (${shop.items.length})'];
      for (final item in shop.items.take(30)) {
        lines.add('- ${item.name} [${item.itemId}] (${item.getPriceText()})');
      }
      if (shop.items.length > 30) {
        lines.add('... (${shop.items.length - 30}개 더 있음)');
      }
      session.addLog(lines.join('\n'), 'SYSTEM');
      return;
    }
    if (lower == 'items') {
      session.send('ROOM_ITEMS_LIST', {});
      return;
    }
    if (lower == 'loot') {
      session.send('ROOM_ITEMS_LIST', {});
      return;
    }
    if (lower == 'quest' || lower == 'quests') {
      session.requestQuestList();
      return;
    }
    if (lower == 'npcs' || lower == 'npc') {
      session.requestNPCList();
      return;
    }
    if (lower == 'stats') {
      session.addLog(session.gameState.getSummary(), 'SYSTEM');
      return;
    }

    // Social System Commands
    if (lower == 'friends' || lower == 'friend list') {
      session.requestFriendList();
      return;
    }
    if (lower.startsWith('friend add ')) {
      final friendName = raw.substring(11).trim();
      if (friendName.isEmpty) {
        session.addLog('사용법: friend add <name>', 'SYSTEM');
        return;
      }
      session.friendAdd(friendName);
      return;
    }
    if (lower.startsWith('friend accept ')) {
      final requestId = raw.substring(14).trim();
      if (requestId.isEmpty) {
        session.addLog('사용법: friend accept <requestId>', 'SYSTEM');
        return;
      }
      session.friendAccept(requestId);
      return;
    }
    if (lower.startsWith('friend remove ')) {
      final friendId = raw.substring(14).trim();
      if (friendId.isEmpty) {
        session.addLog('사용법: friend remove <friendId>', 'SYSTEM');
        return;
      }
      session.friendRemove(friendId);
      return;
    }
    if (lower == 'blacklist' || lower == 'blacklist list') {
      session.requestBlacklistList();
      return;
    }
    if (lower.startsWith('blacklist add ')) {
      final rest = raw.substring(14).trim();
      final parts = rest.split(RegExp(r'\s+'));
      if (parts.isEmpty) {
        session.addLog('사용법: blacklist add <name> [reason]', 'SYSTEM');
        return;
      }
      final blockedName = parts.first;
      final reason = parts.length > 1 ? parts.skip(1).join(' ') : null;
      session.blacklistAdd(blockedName, reason: reason);
      return;
    }
    if (lower.startsWith('blacklist remove ')) {
      final blockedId = raw.substring(17).trim();
      if (blockedId.isEmpty) {
        session.addLog('사용법: blacklist remove <blockedId>', 'SYSTEM');
        return;
      }
      session.blacklistRemove(blockedId);
      return;
    }
    if (lower == 'mail' || lower == 'mail list') {
      session.requestMailList();
      return;
    }
    if (lower.startsWith('mail send ')) {
      final rest = raw.substring(10).trim();
      final parts = rest.split(RegExp(r'\s+'));
      if (parts.length < 3) {
        session.addLog('사용법: mail send <toName> <subject> <content> [gold]', 'SYSTEM');
        return;
      }
      final toName = parts[0];
      final subject = parts[1];
      final content = parts.skip(2).join(' ');
      session.mailSend(toName, subject, content);
      return;
    }
    if (lower.startsWith('mail read ')) {
      final mailId = raw.substring(10).trim();
      if (mailId.isEmpty) {
        session.addLog('사용법: mail read <mailId>', 'SYSTEM');
        return;
      }
      session.mailRead(mailId);
      return;
    }
    if (lower.startsWith('mail claim ')) {
      final mailId = raw.substring(11).trim();
      if (mailId.isEmpty) {
        session.addLog('사용법: mail claim <mailId>', 'SYSTEM');
        return;
      }
      session.mailClaim(mailId);
      return;
    }
    if (lower.startsWith('mail delete ')) {
      final mailId = raw.substring(12).trim();
      if (mailId.isEmpty) {
        session.addLog('사용법: mail delete <mailId>', 'SYSTEM');
        return;
      }
      session.mailDelete(mailId);
      return;
    }

    // Collection System Commands
    if (lower == 'bestiary' || lower == 'bestiary list') {
      session.requestBestiaryList();
      return;
    }
    if (lower == 'titles' || lower == 'title list') {
      session.requestTitleList();
      return;
    }
    if (lower.startsWith('title equip ')) {
      final titleId = raw.substring(12).trim();
      if (titleId.isEmpty) {
        session.addLog('사용법: title equip <titleId>', 'SYSTEM');
        return;
      }
      session.titleEquip(titleId);
      return;
    }
    if (lower == 'collectibles' || lower == 'collectible list') {
      session.requestCollectibleList();
      return;
    }

    // Economy Expansion Commands
    if (lower == 'bank' || lower == 'bank info') {
      session.requestBankInfo();
      return;
    }
    if (lower.startsWith('bank deposit ')) {
      final amountStr = raw.substring(14).trim();
      final amount = int.tryParse(amountStr);
      if (amount == null || amount <= 0) {
        session.addLog('사용법: bank deposit <amount>', 'SYSTEM');
        return;
      }
      session.bankDeposit(amount);
      return;
    }
    if (lower.startsWith('bank withdraw ')) {
      final amountStr = raw.substring(15).trim();
      final amount = int.tryParse(amountStr);
      if (amount == null || amount <= 0) {
        session.addLog('사용법: bank withdraw <amount>', 'SYSTEM');
        return;
      }
      session.bankWithdraw(amount);
      return;
    }
    if (lower == 'bank history') {
      session.requestBankHistory();
      return;
    }
    if (lower == 'exchange' || lower == 'exchange list') {
      session.requestExchangeList();
      return;
    }
    if (lower.startsWith('exchange sell ')) {
      final rest = raw.substring(14).trim();
      final parts = rest.split(RegExp(r'\s+'));
      if (parts.length < 3) {
        session.addLog('사용법: exchange sell <itemId> <qty> <price>', 'SYSTEM');
        return;
      }
      final itemId = parts[0];
      final qty = int.tryParse(parts[1]);
      final price = int.tryParse(parts[2]);
      if (qty == null || price == null || qty <= 0 || price <= 0) {
        session.addLog('수량과 가격은 양수여야 합니다.', 'SYSTEM');
        return;
      }
      session.exchangeSell(itemId, qty, price);
      return;
    }
    if (lower.startsWith('exchange buy ')) {
      final rest = raw.substring(13).trim();
      final parts = rest.split(RegExp(r'\s+'));
      if (parts.isEmpty) {
        session.addLog('사용법: exchange buy <listingId> [qty]', 'SYSTEM');
        return;
      }
      final listingId = parts[0];
      final qty = parts.length > 1 ? int.tryParse(parts[1]) ?? 1 : 1;
      session.exchangeBuy(listingId, qty: qty);
      return;
    }
    if (lower.startsWith('exchange cancel ')) {
      final listingId = raw.substring(16).trim();
      if (listingId.isEmpty) {
        session.addLog('사용법: exchange cancel <listingId>', 'SYSTEM');
        return;
      }
      session.exchangeCancel(listingId);
      return;
    }

    // Admin Commands
    if (lower == 'admin stats' || lower == 'adminstat') {
      session.requestAdminStats();
      return;
    }

    if (lower == 'search' || lower == 'scavenge') {
      session.send('SEARCH', {});
      return;
    }
    if (lower == 'nodes') {
      session.requestNodeList();
      return;
    }
    if (lower.startsWith('gather ')) {
      final nodeId = raw.substring(7).trim();
      if (nodeId.isEmpty) {
        session.addLog('사용법: gather <nodeId>', 'SYSTEM');
        return;
      }
      session.gather(nodeId: nodeId);
      return;
    }

    // guild commands
    if (lower == 'guilds') {
      session.requestGuildList();
      return;
    }
    if (lower.startsWith('guild ')) {
      final rest = raw.substring(6).trim();
      if (rest.startsWith('create ')) {
        final args = rest.substring(7).trim();
        if (args.isEmpty) return;
        final parts = args.split(RegExp(r'\s+'));
        final name = parts.first.trim();
        final desc = parts.skip(1).join(' ').trim();
        session.createGuild(name: name, description: desc);
        return;
      }
      if (rest.startsWith('join ')) {
        final id = rest.substring(5).trim();
        if (id.isEmpty) return;
        session.joinGuild(guildId: id);
        return;
      }
      if (rest == 'leave') {
        session.send('GUILD_LEAVE', {});
        return;
      }
    }
    if (lower.startsWith('g ')) {
      final text = raw.substring(2).trim();
      if (text.isEmpty) return;
      session.send('GUILD_CHAT_SEND', {'text': text});
      return;
    }

    // guild vault
    if (lower == 'vault') {
      session.requestGuildVaultList();
      return;
    }
    if (lower.startsWith('vault ')) {
      final rest = raw.substring(6).trim();
      if (rest.startsWith('deposit gold ')) {
        final amount = int.tryParse(rest.substring(13).trim());
        if (amount == null || amount <= 0) {
          session.addLog('사용법: vault deposit gold <amount>', 'SYSTEM');
          return;
        }
        session.guildVaultDepositGold(amount: amount);
        return;
      }
      if (rest.startsWith('withdraw gold ')) {
        final amount = int.tryParse(rest.substring(14).trim());
        if (amount == null || amount <= 0) {
          session.addLog('사용법: vault withdraw gold <amount>', 'SYSTEM');
          return;
        }
        session.guildVaultWithdrawGold(amount: amount);
        return;
      }
      if (rest.startsWith('deposit ')) {
        final args = rest.substring(8).trim().split(RegExp(r'\s+'));
        if (args.isEmpty) {
          session.addLog('사용법: vault deposit <item> [qty]', 'SYSTEM');
          return;
        }
        final itemQuery = args.first;
        final qty = args.length >= 2 ? (int.tryParse(args[1]) ?? 1) : 1;
        final itemId = _findInventoryItemId(session, itemQuery);
        if (itemId == null) {
          session.addLog('아이템을 찾을 수 없습니다: "$itemQuery" (inv로 확인)', 'SYSTEM');
          return;
        }
        session.guildVaultDepositItem(itemId: itemId, qty: qty);
        return;
      }
      if (rest.startsWith('withdraw ')) {
        final args = rest.substring(9).trim().split(RegExp(r'\s+'));
        if (args.isEmpty) {
          session.addLog('사용법: vault withdraw <item> [qty]', 'SYSTEM');
          return;
        }
        final itemQuery = args.first;
        final qty = args.length >= 2 ? (int.tryParse(args[1]) ?? 1) : 1;
        // TODO: 길드 금고 아이템 목록에서 찾기 (현재는 itemId 직접 입력)
        session.guildVaultWithdrawItem(itemId: itemQuery, qty: qty);
        return;
      }
      session.addLog('알 수 없는 vault 명령: "$rest"', 'SYSTEM');
      return;
    }

    // crafting
    if (lower == 'recipes') {
      session.requestCraftingRecipes();
      return;
    }
    if (lower.startsWith('craft ')) {
      final recipeId = raw.substring(6).trim();
      if (recipeId.isEmpty) return;
      session.craftItem(recipeId: recipeId);
      return;
    }

    // achievements
    if (lower == 'ach' || lower == 'achievements') {
      session.requestAchievements();
      return;
    }
    if (lower.startsWith('ach claim ')) {
      final id = raw.substring('ach claim '.length).trim();
      if (id.isEmpty) return;
      session.claimAchievement(achievementId: id);
      return;
    }

    // trade (simple)
    if (lower.startsWith('trade ')) {
      final rest = raw.substring(6).trim();
      if (rest.startsWith('accept ')) {
        final offerId = rest.substring(7).trim();
        if (offerId.isEmpty) return;
        session.send('TRADE_OFFER_ACCEPT', {'offerId': offerId});
        return;
      }
      if (rest.startsWith('reject ')) {
        final offerId = rest.substring(7).trim();
        if (offerId.isEmpty) return;
        session.send('TRADE_OFFER_REJECT', {'offerId': offerId});
        return;
      }
      // trade <targetName> [gold]
      final parts = rest.split(RegExp(r'\s+'));
      if (parts.isEmpty) return;
      final target = parts.first;
      int gold = 0;
      if (parts.length >= 2) {
        gold = int.tryParse(parts[1]) ?? 0;
      }
      session.sendTradeOffer(targetName: target, offeredItems: const [], offeredGold: gold);
      return;
    }

    // guild quest
    if (lower == 'gquest' || lower == 'gquest list') {
      session.requestGuildQuestList();
      return;
    }
    if (lower.startsWith('gquest ')) {
      final rest = raw.substring(7).trim();
      if (rest.startsWith('accept ')) {
        final questId = rest.substring(7).trim();
        if (questId.isEmpty) {
          session.addLog('사용법: gquest accept <questId>', 'SYSTEM');
          return;
        }
        session.guildQuestAccept(questId: questId);
        return;
      }
      if (rest.startsWith('turnin ')) {
        final questId = rest.substring(7).trim();
        if (questId.isEmpty) {
          session.addLog('사용법: gquest turnin <questId>', 'SYSTEM');
          return;
        }
        session.guildQuestTurnin(questId: questId);
        return;
      }
      session.addLog('알 수 없는 gquest 명령: "$rest"', 'SYSTEM');
      return;
    }

    // dungeon status
    if (lower == 'dungeon status') {
      session.requestDungeonStatus();
      return;
    }

    // raid status
    if (lower == 'raid status') {
      session.requestRaidStatus();
      return;
    }

    // pet
    if (lower == 'pets' || lower == 'pet') {
      session.requestPetList();
      return;
    }
    if (lower.startsWith('pet ')) {
      final rest = raw.substring(4).trim();
      if (rest == 'dismiss') {
        session.dismissPet();
        return;
      }
      if (rest.startsWith('summon ')) {
        final petId = rest.substring(7).trim();
        if (petId.isEmpty) {
          session.addLog('사용법: pet summon <petId>', 'SYSTEM');
          return;
        }
        session.summonPet(petId: petId);
        return;
      }
      session.addLog('알 수 없는 pet 명령: "$rest"', 'SYSTEM');
      return;
    }

    // house
    if (lower == 'house') {
      session.requestHouseInfo();
      return;
    }
    if (lower.startsWith('house ')) {
      final rest = raw.substring(6).trim();
      if (rest.startsWith('create ')) {
        final name = rest.substring(7).trim();
        if (name.isEmpty) {
          session.addLog('사용법: house create <name>', 'SYSTEM');
          return;
        }
        session.createHouse(name: name);
        return;
      }
      if (rest.startsWith('storage ')) {
        final parts = rest.substring(8).trim().split(RegExp(r'\s+'));
        if (parts.length < 2) {
          session.addLog('사용법: house storage <deposit|withdraw> <item> [qty]', 'SYSTEM');
          return;
        }
        final action = parts[0].toLowerCase();
        final itemId = parts[1];
        final qty = parts.length >= 3 ? int.tryParse(parts[2]) ?? 1 : 1;
        if (action != 'deposit' && action != 'withdraw') {
          session.addLog('action은 deposit 또는 withdraw여야 합니다', 'SYSTEM');
          return;
        }
        session.houseStorage(action: action, itemId: itemId, qty: qty);
        return;
      }
      session.addLog('알 수 없는 house 명령: "$rest"', 'SYSTEM');
      return;
    }

    // farm
    if (lower.startsWith('farm ')) {
      final rest = raw.substring(5).trim();
      if (rest.startsWith('plant ')) {
        final parts = rest.substring(6).trim().split(RegExp(r'\s+'));
        if (parts.length < 2) {
          session.addLog('사용법: farm plant <plotIndex> <cropId>', 'SYSTEM');
          return;
        }
        final plotIndex = int.tryParse(parts[0]);
        final cropId = parts[1];
        if (plotIndex == null) {
          session.addLog('plotIndex는 숫자여야 합니다', 'SYSTEM');
          return;
        }
        session.farmPlant(plotIndex: plotIndex, cropId: cropId);
        return;
      }
      if (rest.startsWith('harvest ')) {
        final plotIndex = int.tryParse(rest.substring(8).trim());
        if (plotIndex == null) {
          session.addLog('사용법: farm harvest <plotIndex>', 'SYSTEM');
          return;
        }
        session.farmHarvest(plotIndex: plotIndex);
        return;
      }
      session.addLog('알 수 없는 farm 명령: "$rest"', 'SYSTEM');
      return;
    }

    // event
    if (lower == 'events' || lower == 'event') {
      session.requestEventList();
      return;
    }
    if (lower.startsWith('event ')) {
      final rest = raw.substring(6).trim();
      if (rest.startsWith('join ')) {
        final eventId = rest.substring(5).trim();
        if (eventId.isEmpty) {
          session.addLog('사용법: event join <eventId>', 'SYSTEM');
          return;
        }
        session.joinEvent(eventId: eventId);
        return;
      }
      session.addLog('알 수 없는 event 명령: "$rest"', 'SYSTEM');
      return;
    }

    // ranking
    if (lower == 'ranking' || lower.startsWith('ranking ')) {
      final rest = raw.substring(8).trim();
      if (rest.startsWith('dungeon')) {
        final parts = rest.substring(8).trim().split(RegExp(r'\s+'));
        final dungeonId = parts.isNotEmpty && parts[0].isNotEmpty ? parts[0] : null;
        final difficulty = parts.length >= 2 ? parts[1].toUpperCase() : 'NORMAL';
        session.requestRankingDungeon(dungeonId: dungeonId, difficulty: difficulty);
        return;
      }
      if (rest.startsWith('raid')) {
        final parts = rest.substring(4).trim().split(RegExp(r'\s+'));
        final raidId = parts.isNotEmpty && parts[0].isNotEmpty ? parts[0] : null;
        session.requestRankingRaid(raidId: raidId);
        return;
      }
      session.addLog('사용법: ranking dungeon [dungeonId] [difficulty] 또는 ranking raid [raidId]', 'SYSTEM');
      return;
    }

    // marketplace
    if (lower == 'market' || lower == 'marketplace') {
      session.requestMarketplaceList();
      return;
    }
    if (lower.startsWith('market ')) {
      final rest = raw.substring(7).trim();
      if (rest.isEmpty) {
        session.requestMarketplaceList();
        return;
      }
      if (rest == 'list') {
        session.requestMarketplaceList();
        return;
      }
      if (rest.startsWith('list ')) {
        final itemId = rest.substring(5).trim();
        session.requestMarketplaceList(itemId: itemId.isEmpty ? null : itemId);
        return;
      }
      if (rest.startsWith('sell ')) {
        final parts = rest.substring(5).trim().split(RegExp(r'\s+'));
        if (parts.length < 3) {
          session.addLog('사용법: market sell <item> <qty> <startPrice> [buyNowPrice]', 'SYSTEM');
          return;
        }
        final itemQuery = parts[0];
        final qty = int.tryParse(parts[1]);
        final startPrice = int.tryParse(parts[2]);
        final buyNowPrice = parts.length >= 4 ? int.tryParse(parts[3]) : null;
        if (qty == null || qty <= 0 || startPrice == null || startPrice <= 0) {
          session.addLog('qty와 startPrice는 양수여야 합니다.', 'SYSTEM');
          return;
        }
        final itemId = _findInventoryItemId(session, itemQuery);
        if (itemId == null) {
          session.addLog('아이템을 찾을 수 없습니다: "$itemQuery" (inv로 확인)', 'SYSTEM');
          return;
        }
        session.marketplaceListingCreate(
          itemId: itemId,
          qty: qty,
          startingPrice: startPrice,
          buyNowPrice: buyNowPrice,
        );
        return;
      }
      if (rest.startsWith('bid ')) {
        final parts = rest.substring(4).trim().split(RegExp(r'\s+'));
        if (parts.length < 2) {
          session.addLog('사용법: market bid <listingId> <amount>', 'SYSTEM');
          return;
        }
        final listingId = parts[0];
        final amount = int.tryParse(parts[1]);
        if (amount == null || amount <= 0) {
          session.addLog('amount는 양수여야 합니다.', 'SYSTEM');
          return;
        }
        session.marketplaceBid(listingId: listingId, bidAmount: amount);
        return;
      }
      if (rest.startsWith('buy ')) {
        final listingId = rest.substring(4).trim();
        if (listingId.isEmpty) {
          session.addLog('사용법: market buy <listingId>', 'SYSTEM');
          return;
        }
        session.marketplaceBuyNow(listingId: listingId);
        return;
      }
      if (rest.startsWith('cancel ')) {
        final listingId = rest.substring(7).trim();
        if (listingId.isEmpty) {
          session.addLog('사용법: market cancel <listingId>', 'SYSTEM');
          return;
        }
        session.marketplaceCancel(listingId: listingId);
        return;
      }
      session.addLog('알 수 없는 market 명령: "$rest"', 'SYSTEM');
      return;
    }

    // pvp
    if (lower.startsWith('pvp ')) {
      final rest = raw.substring(4).trim();
      if (rest.isEmpty) {
        session.addLog('사용법: pvp challenge <name> [betGold], pvp accept <matchId>, pvp ranking', 'SYSTEM');
        return;
      }
      if (rest == 'ranking') {
        session.requestPvpRanking();
        return;
      }
      if (rest.startsWith('challenge ')) {
        final args = rest.substring(10).trim().split(RegExp(r'\s+'));
        if (args.isEmpty) {
          session.addLog('사용법: pvp challenge <name> [betGold]', 'SYSTEM');
          return;
        }
        final defenderName = args.first;
        final betGold = args.length >= 2 ? (int.tryParse(args[1]) ?? 0) : 0;
        session.pvpChallenge(defenderName: defenderName, betGold: betGold);
        return;
      }
      if (rest.startsWith('accept ')) {
        final matchId = rest.substring(7).trim();
        if (matchId.isEmpty) {
          session.addLog('사용법: pvp accept <matchId>', 'SYSTEM');
          return;
        }
        session.pvpAccept(matchId: matchId);
        return;
      }
      session.addLog('알 수 없는 pvp 명령: "$rest"', 'SYSTEM');
      return;
    }

    // fun: roll / coin
    if (lower == 'coin' || lower == 'flip') {
      final v = (DateTime.now().microsecondsSinceEpoch % 2 == 0) ? '앞면' : '뒷면';
      session.addLog('🪙 코인: $v', 'SYSTEM');
      return;
    }
    if (lower.startsWith('roll')) {
      final parts = raw.split(RegExp(r'\s+'));
      int sides = 100;
      if (parts.length >= 2) {
        final maybe = int.tryParse(parts[1]);
        if (maybe != null && maybe >= 2 && maybe <= 100000) {
          sides = maybe;
        }
      }
      final r = (DateTime.now().microsecondsSinceEpoch % sides) + 1;
      session.addLog('🎲 roll d$sides → $r', 'SYSTEM');
      return;
    }

    // 이동
    const dirMap = {
      'n': 'N',
      'north': 'N',
      's': 'S',
      'south': 'S',
      'e': 'E',
      'east': 'E',
      'w': 'W',
      'west': 'W',
      'u': 'U',
      'up': 'U',
      'd': 'D',
      'down': 'D',
    };
    if (dirMap.containsKey(lower)) {
      session.moveDirByExits(dirMap[lower]!);
      return;
    }

    // hunt
    if (lower == 'hunt') {
      session.hunt();
      return;
    }

    // 말하기(로컬)
    if (lower.startsWith('say ')) {
      final text = raw.substring(4).trim();
      if (text.isEmpty) return;
      session.send('CHAT_SEND', {'channel': 'LOCAL', 'text': text});
      return;
    }

    // buy <item> [qty] (SHOP_BUY는 1개씩만 지원 → 반복 구매)
    if (lower.startsWith('buy ')) {
      final rest = raw.substring(4).trim();
      if (rest.isEmpty) return;
      final parts = rest.split(RegExp(r'\s+'));
      int qty = 1;
      if (parts.length >= 2) {
        final maybeQty = int.tryParse(parts.last);
        if (maybeQty != null && maybeQty > 0) {
          qty = maybeQty;
          parts.removeLast();
        }
      }
      final q = parts.join(' ').trim();
      final itemId = _findShopItemId(session, q);
      if (itemId == null) {
        session.addLog('구매할 아이템을 찾을 수 없습니다: "$q" (shop로 목록 확인)', 'SYSTEM');
        return;
      }
      session.sendWithReqId('SHOP_BUY', {'itemId': itemId, 'qty': qty});
      session.addLog('🛒 구매 요청: $itemId x$qty', 'ACTION');
      return;
    }

    // sell <item> [qty]
    if (lower.startsWith('sell ')) {
      final rest = raw.substring(5).trim();
      if (rest.isEmpty) return;
      final parts = rest.split(RegExp(r'\s+'));
      int qty = 1;
      if (parts.length >= 2) {
        final maybeQty = int.tryParse(parts.last);
        if (maybeQty != null && maybeQty > 0) {
          qty = maybeQty;
          parts.removeLast();
        }
      }
      final q = parts.join(' ').trim();
      final itemId = _findInventoryItemId(session, q);
      if (itemId == null) {
        session.addLog('판매할 아이템을 찾을 수 없습니다: "$q" (inv로 확인)', 'SYSTEM');
        return;
      }
      session.send('SHOP_SELL', {'itemId': itemId, 'qty': qty});
      session.addLog('💰 판매 요청: $itemId x$qty', 'ACTION');
      return;
    }

    // accept <questId>
    if (lower.startsWith('accept ')) {
      final questId = raw.substring(7).trim();
      if (questId.isEmpty) return;
      session.questAccept(questId);
      return;
    }

    // turnin <questId>
    if (lower.startsWith('turnin ') || lower.startsWith('turn-in ')) {
      final questId = raw.split(RegExp(r'\s+')).skip(1).join(' ').trim();
      if (questId.isEmpty) return;
      session.questTurnIn(questId);
      return;
    }

    // talk <npcId|name>
    if (lower.startsWith('talk ')) {
      final q = raw.substring(5).trim();
      if (q.isEmpty) return;

      // 마지막 토큰이 숫자면 choiceIndex로 간주
      int? choiceOneBased;
      final parts = q.split(RegExp(r'\s+'));
      if (parts.length >= 2) {
        final maybe = int.tryParse(parts.last);
        if (maybe != null && maybe > 0) {
          choiceOneBased = maybe;
          parts.removeLast();
        }
      }
      final npcQuery = parts.join(' ').trim();

      if (session.npcs.isEmpty) {
        session.requestNPCList();
        session.addLog('👥 NPC 목록이 없어 조회했습니다. npcs 후 다시 시도하세요.', 'SYSTEM');
        return;
      }
      final npcId = _findNpcId(session, npcQuery);
      if (npcId == null) {
        session.addLog('NPC를 찾을 수 없습니다: "$npcQuery" (npcs로 확인)', 'SYSTEM');
        return;
      }
      if (choiceOneBased != null) {
        session.talkToNPC(npcId, choiceIndex: choiceOneBased - 1);
      } else {
        session.talkToNPC(npcId);
      }
      return;
    }

    // choose <n>
    if (lower.startsWith('choose ')) {
      final n = int.tryParse(raw.substring(7).trim());
      if (n == null) return;
      session.chooseNpc(n);
      return;
    }

    // equip <item>
    if (lower.startsWith('equip ')) {
      final q = raw.substring(6).trim();
      if (q.isEmpty) return;
      final itemId = _findInventoryItemId(session, q);
      if (itemId == null) {
        session.addLog('장착할 아이템을 찾을 수 없습니다: "$q" (inv로 확인)', 'SYSTEM');
        return;
      }
      session.send('EQUIP', {'itemId': itemId});
      return;
    }

    // unequip <slot|icon|title>
    if (lower.startsWith('unequip ')) {
      final arg = raw.substring(8).trim();
      if (arg.isEmpty) return;
      final a = arg.toLowerCase();
      if (a == 'icon') {
        session.send('USE_ITEM', {'itemId': '__UNEQUIP_ICON__', 'qty': 1});
        return;
      }
      if (a == 'title') {
        session.send('USE_ITEM', {'itemId': '__UNEQUIP_TITLE__', 'qty': 1});
        return;
      }
      session.send('UNEQUIP', {'slot': _normalizeSlot(arg)});
      return;
    }

    // enhance <slot>
    if (lower.startsWith('enhance ')) {
      final slot = raw.substring(8).trim();
      if (slot.isEmpty) return;
      session.enhance(slot: _normalizeSlot(slot));
      return;
    }

    // use <item> [qty]
    if (lower.startsWith('use ')) {
      final rest = raw.substring(4).trim();
      if (rest.isEmpty) return;
      final parts = rest.split(RegExp(r'\s+'));
      int qty = 1;
      if (parts.length >= 2) {
        final maybeQty = int.tryParse(parts.last);
        if (maybeQty != null && maybeQty > 0) {
          qty = maybeQty;
          parts.removeLast();
        }
      }
      final q = parts.join(' ').trim();
      final itemId = _findInventoryItemId(session, q);
      if (itemId == null) {
        session.addLog('사용할 아이템을 찾을 수 없습니다: "$q" (inv로 확인)', 'SYSTEM');
        return;
      }
      session.send('USE_ITEM', {'itemId': itemId, 'qty': qty});
      return;
    }

    // attack/kill <monster>
    if (lower.startsWith('attack ') || lower.startsWith('kill ')) {
      final q = raw.split(RegExp(r'\s+')).skip(1).join(' ').trim();
      if (q.isEmpty) return;
      // 최신 목록이 없으면 먼저 요청
      if (session.roomMonsters.isEmpty) {
        session.requestRoomMonsters();
        session.addLog('👹 몬스터 목록이 없어 조회했습니다. monsters 후 다시 시도하세요.', 'SYSTEM');
        return;
      }
      final monsterId = _findMonsterId(session, q);
      if (monsterId == null) {
        session.addLog('대상을 찾을 수 없습니다: "$q" (monsters로 확인)', 'SYSTEM');
        return;
      }
      session.send('ATTACK', {'target': monsterId});
      return;
    }

    // cast <spell> [target]
    if (lower.startsWith('cast ')) {
      final rest = raw.substring(5).trim();
      if (rest.isEmpty) return;
      final parts = rest.split(RegExp(r'\s+'));
      final spell = parts.first;
      final target = parts.length >= 2 ? parts.skip(1).join(' ').trim() : null;
      session.cast(spell: spell, target: (target != null && target.isNotEmpty) ? target : null);
      return;
    }

    // get/take <item> [qty]
    if (lower.startsWith('get ') || lower.startsWith('take ')) {
      final rest = raw.split(RegExp(r'\s+')).skip(1).join(' ').trim();
      if (rest.isEmpty) return;
      if (rest.toLowerCase() == 'all') {
        // 간단 구현: 서버 측 all 지원은 없으므로 현재 목록 기반으로 반복 GET
        if (session.roomItems.isEmpty) {
          session.send('ROOM_ITEMS_LIST', {});
          session.addLog('🧺 바닥 아이템 목록이 없어 조회했습니다. loot 후 다시 시도하세요.', 'SYSTEM');
          return;
        }
        for (final it in session.roomItems) {
          final itemId = it['itemId']?.toString();
          final qtyAny = it['qty'];
          final qty = (qtyAny is int) ? qtyAny : int.tryParse(qtyAny?.toString() ?? '1') ?? 1;
          if (itemId != null && qty > 0) {
            session.send('GET_ITEM', {'itemId': itemId, 'qty': qty});
          }
        }
        return;
      }
      final parts = rest.split(RegExp(r'\s+'));
      int qty = 1;
      if (parts.length >= 2) {
        final maybeQty = int.tryParse(parts.last);
        if (maybeQty != null && maybeQty > 0) {
          qty = maybeQty;
          parts.removeLast();
        }
      }
      final q = parts.join(' ').trim();
      if (session.roomItems.isEmpty) {
        session.send('ROOM_ITEMS_LIST', {});
        session.addLog('🧺 바닥 아이템 목록이 없어 조회했습니다. items 후 다시 시도하세요.', 'SYSTEM');
        return;
      }
      final itemId = _findRoomItemId(session, q);
      if (itemId == null) {
        session.addLog('바닥 아이템을 찾을 수 없습니다: "$q" (items로 확인)', 'SYSTEM');
        return;
      }
      session.send('GET_ITEM', {'itemId': itemId, 'qty': qty});
      return;
    }

    // drop <item> [qty]
    if (lower.startsWith('drop ')) {
      final rest = raw.substring(5).trim();
      if (rest.isEmpty) return;
      if (rest.toLowerCase() == 'all') {
        final inv = session.gameState.inventory ?? [];
        if (inv.isEmpty) {
          session.addLog('인벤토리가 비어있습니다.', 'SYSTEM');
          return;
        }
        for (final it in inv) {
          if (it.qty > 0) {
            session.send('DROP_ITEM', {'itemId': it.itemId, 'qty': it.qty});
          }
        }
        return;
      }
      final parts = rest.split(RegExp(r'\s+'));
      int qty = 1;
      if (parts.length >= 2) {
        final maybeQty = int.tryParse(parts.last);
        if (maybeQty != null && maybeQty > 0) {
          qty = maybeQty;
          parts.removeLast();
        }
      }
      final q = parts.join(' ').trim();
      final itemId = _findInventoryItemId(session, q);
      if (itemId == null) {
        session.addLog('버릴 아이템을 찾을 수 없습니다: "$q" (inv로 확인)', 'SYSTEM');
        return;
      }
      session.send('DROP_ITEM', {'itemId': itemId, 'qty': qty});
      return;
    }

    // 슬래시 커맨드 호환
    if (raw.startsWith('/')) {
      final cmd = raw.substring(1).trim();
      if (cmd.isEmpty) return;
      _runCommand(session, cmd);
      return;
    }

    session.addLog('알 수 없는 명령: "$raw" (help 입력)', 'SYSTEM');
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        final enabled = session.isConnected;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            border: Border(
              top: BorderSide(color: Colors.grey[300]!),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  enabled: enabled,
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: enabled ? '명령 입력 (help, look, n/s/e/w...)' : '서버 연결 중...',
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (value) {
                    final text = value;
                    _controller.clear();
                    _runCommand(session, text);
                  },
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: enabled
                    ? () {
                        final text = _controller.text;
                        _controller.clear();
                        _runCommand(session, text);
                      }
                    : null,
                child: const Text('전송'),
              ),
            ],
          ),
        );
      },
    );
  }
}


