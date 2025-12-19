import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models.dart';
import '../../state/session_state.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<InventoryItem> _inventory = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInventory();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInventory() async {
    final session = context.read<SessionState>();
    session.send('INVENTORY_LIST', {});
    
    // 응답 대기 (간단한 구현)
    await Future.delayed(const Duration(milliseconds: 500));
    
    if (mounted) {
      setState(() {
        _inventory = session.gameState.inventory ?? [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('인벤토리 & 장비'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.inventory), text: '인벤토리'),
            Tab(icon: Icon(Icons.shield), text: '장비'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildInventoryTab(),
          _buildEquipmentTab(),
        ],
      ),
    );
  }

  Widget _buildInventoryTab() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_inventory.isEmpty) {
      return const Center(
        child: Text('인벤토리가 비어있습니다.', style: TextStyle(fontSize: 16, color: Colors.grey)),
      );
    }

    return ListView.builder(
      itemCount: _inventory.length,
      itemBuilder: (context, index) {
        final item = _inventory[index];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: ListTile(
            leading: Icon(
              _getItemIcon(item.type),
              color: _getRarityColor(item.type),
              size: 36,
            ),
            title: Text('${item.name} x${item.qty}'),
            subtitle: Text(
              _getItemStatsText(item),
              style: const TextStyle(fontSize: 12),
            ),
            trailing: _buildItemTrailing(item),
          ),
        );
      },
    );
  }

  Widget _buildEquipmentTab() {
    final session = context.watch<SessionState>();
    final equipment = session.gameState.equipment ?? {};
    final bonus = session.gameState.equipmentBonus ?? {'atk': 0, 'def': 0, 'hpBonus': 0};

    return Column(
      children: [
        // 스탯 요약
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.blue[50],
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatChip('⚔️ 공격', bonus['atk'] ?? 0, Colors.red),
              _buildStatChip('🛡️ 방어', bonus['def'] ?? 0, Colors.blue),
              _buildStatChip('❤️ HP+', bonus['hpBonus'] ?? 0, Colors.green),
            ],
          ),
        ),
        const Divider(height: 1),
        // 장비 슬롯
        Expanded(
          child: ListView(
            children: [
              _buildEquipmentSlot('무기', 'WEAPON', equipment['WEAPON']),
              _buildEquipmentSlot('방어구', 'BODY', equipment['BODY']),
              _buildEquipmentSlot('장신구', 'ACCESSORY', equipment['ACCESSORY']),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatChip(String label, int value, Color color) {
    return Chip(
      avatar: CircleAvatar(
        backgroundColor: color.withOpacity(0.2),
        child: Text(
          '$value',
          style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
        ),
      ),
      label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
      backgroundColor: color.withOpacity(0.1),
    );
  }

  Widget _buildEquipmentSlot(String label, String slot, EquippedItem? item) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: Icon(
          _getSlotIcon(slot),
          size: 36,
          color: item != null ? Colors.amber : Colors.grey,
        ),
        title: Text('[$label]'),
        subtitle: item != null
            ? Text(
                '${item.name}\n공: ${item.atk}, 방: ${item.def}, HP+: ${item.hpBonus}',
                style: const TextStyle(fontSize: 12),
              )
            : const Text('장착 안 됨', style: TextStyle(fontSize: 12, color: Colors.grey)),
        trailing: item != null
            ? IconButton(
                icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                onPressed: () => _unequipItem(slot),
              )
            : null,
      ),
    );
  }

  IconData _getItemIcon(String type) {
    switch (type.toLowerCase()) {
      case 'weapon':
        return Icons.sports_kabaddi;
      case 'armor':
        return Icons.shield;
      case 'accessory':
        return Icons.stars;
      case 'consumable':
        return Icons.local_drink;
      default:
        return Icons.category;
    }
  }

  IconData _getSlotIcon(String slot) {
    switch (slot) {
      case 'WEAPON':
        return Icons.sports_kabaddi;
      case 'BODY':
        return Icons.shield;
      case 'ACCESSORY':
        return Icons.stars;
      default:
        return Icons.help_outline;
    }
  }

  Color _getRarityColor(String type) {
    switch (type.toLowerCase()) {
      case 'weapon':
        return Colors.red;
      case 'armor':
        return Colors.blue;
      case 'accessory':
        return Colors.purple;
      case 'consumable':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  String _getItemStatsText(InventoryItem item) {
    final parts = <String>[];
    if (item.atk > 0) parts.add('공격: ${item.atk}');
    if (item.def > 0) parts.add('방어: ${item.def}');
    if (item.hpBonus > 0) parts.add('HP+: ${item.hpBonus}');
    if (parts.isEmpty) return '타입: ${item.type}';
    return parts.join(', ');
  }

  Widget _buildItemTrailing(InventoryItem item) {
    final session = context.read<SessionState>();
    final gs = session.gameState;
    
    // 코스메틱 아이템 (아이콘/칭호) 확인
    final isIconCosmetic = RegExp(r'^ITEM_ICON_BONUS_S\d+$').hasMatch(item.itemId);
    final isTitleCosmetic = RegExp(r'^ITEM_TITLE_BONUS_S\d+$').hasMatch(item.itemId);

    if (isIconCosmetic || isTitleCosmetic) {
      // 현재 장착 여부 확인
      final isEquipped = (isIconCosmetic && gs.cosmeticIconItemId == item.itemId) ||
                         (isTitleCosmetic && gs.cosmeticTitleItemId == item.itemId);
      
      if (isEquipped) {
        // 이미 장착된 코스메틱
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.green[100],
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '적용됨',
            style: TextStyle(
              fontSize: 12,
              color: Colors.green[700],
              fontWeight: FontWeight.bold,
            ),
          ),
        );
      } else {
        // 코스메틱 적용 버튼
        return ElevatedButton(
          onPressed: () => _useItem(item),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.purple[700],
            foregroundColor: Colors.white,
          ),
          child: const Text('적용'),
        );
      }
    } else if (item.type == 'consumable') {
      // 포션 사용 버튼
      return ElevatedButton(
        onPressed: () => _useItem(item),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.purple,
          foregroundColor: Colors.white,
        ),
        child: const Text('사용'),
      );
    } else if (item.slot != null) {
      // 장비 장착 버튼
      return ElevatedButton(
        onPressed: () => _equipItem(item),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green[700],
          foregroundColor: Colors.white,
        ),
        child: const Text('장착'),
      );
    } else {
      return Text(
        '판매: ${item.priceSell}G',
        style: const TextStyle(fontSize: 12, color: Colors.amber),
      );
    }
  }

  void _useItem(InventoryItem item) {
    final session = context.read<SessionState>();
    session.send('USE_ITEM', {'itemId': item.itemId, 'qty': 1});
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${item.name}을(를) 사용 중...')),
    );

    // 재로드
    Future.delayed(const Duration(milliseconds: 300), () {
      _loadInventory();
    });
  }

  void _equipItem(InventoryItem item) {
    final session = context.read<SessionState>();
    session.send('EQUIP', {'itemId': item.itemId});
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${item.name}을(를) 장착 중...')),
    );

    // 재로드
    Future.delayed(const Duration(milliseconds: 300), () {
      _loadInventory();
    });
  }

  void _unequipItem(String slot) {
    final session = context.read<SessionState>();
    session.send('UNEQUIP', {'slot': slot});
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('장비 해제 중...')),
    );

    // 재로드
    Future.delayed(const Duration(milliseconds: 300), () {
      _loadInventory();
    });
  }
}

