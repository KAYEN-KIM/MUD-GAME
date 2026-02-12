import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';

class EnhancementScreen extends StatefulWidget {
  const EnhancementScreen({Key? key}) : super(key: key);

  @override
  State<EnhancementScreen> createState() => _EnhancementScreenState();
}

class _EnhancementScreenState extends State<EnhancementScreen> {
  String? _selectedItemId;
  bool _useProtection = false;

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final inventory = session.gameState.inventory ?? <InventoryItem>[];
    final equipment =
        inventory.where((item) => item.type == 'weapon' || item.type == 'armor').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('장비 강화'),
        backgroundColor: Colors.orange[700],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoCard(),
            const SizedBox(height: 16),
            _buildItemSelectionCard(equipment),
            const SizedBox(height: 16),
            if (_selectedItemId != null) _buildEnhancementCard(session),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard() {
    return Card(
      color: Colors.orange[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.info_outline, color: Colors.orange[700]),
                const SizedBox(width: 8),
                const Text(
                  '강화 시스템',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              '• 강화 레벨: +0 ~ +10\n'
              '• 성공 시: 레벨 증가\n'
              '• 실패 시: 레벨 하락 또는 파괴\n'
              '• 보호 주문서: 실패 시 파괴 방지',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItemSelectionCard(List<InventoryItem> equipment) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '강화할 장비 선택',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            if (equipment.isEmpty)
              const Center(
                child: Text('강화 가능한 장비가 없습니다', style: TextStyle(color: Colors.grey)),
              )
            else
              ...equipment.map((item) {
                final isSelected = _selectedItemId == item.itemId;
                return Card(
                  color: isSelected ? Colors.orange[100] : null,
                  child: ListTile(
                    leading: const Icon(Icons.security),
                    title: Text(item.name),
                    subtitle: Text('레벨: +0'), // TODO: 실제 강화 레벨 표시
                    trailing: isSelected
                        ? const Icon(Icons.check_circle, color: Colors.orange)
                        : null,
                    onTap: () {
                      setState(() {
                        _selectedItemId = item.itemId;
                      });
                    },
                  ),
                );
              }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildEnhancementCard(SessionState session) {
    final goldCost = 1000; // TODO: 실제 비용 계산

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '강화 옵션',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            CheckboxListTile(
              title: const Text('보호 주문서 사용'),
              subtitle: const Text('실패 시 장비 파괴 방지 (비용: +5,000 골드)'),
              value: _useProtection,
              onChanged: (value) {
                setState(() {
                  _useProtection = value ?? false;
                });
              },
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('강화 비용:', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                    '${goldCost + (_useProtection ? 5000 : 0)} 골드',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                session.enhanceItem(
                  itemId: _selectedItemId!,
                  useProtection: _useProtection,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange[700],
                minimumSize: const Size(double.infinity, 56),
              ),
              child: const Text(
                '강화하기',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

