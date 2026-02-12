import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';
import '../../core/models_extended.dart';

class TradeScreen extends StatefulWidget {
  const TradeScreen({Key? key}) : super(key: key);

  @override
  State<TradeScreen> createState() => _TradeScreenState();
}

class _TradeScreenState extends State<TradeScreen> {
  final TextEditingController _targetNameController = TextEditingController();
  final TextEditingController _goldController = TextEditingController();
  List<String> _selectedItems = [];

  @override
  void dispose() {
    _targetNameController.dispose();
    _goldController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final inventory = session.gameState.inventory ?? <InventoryItem>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('거래'),
        backgroundColor: Colors.amber[700],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTradeOfferSection(session, inventory),
            const SizedBox(height: 24),
            _buildActiveTradesSection(session),
          ],
        ),
      ),
    );
  }

  Widget _buildTradeOfferSection(SessionState session, List<InventoryItem> inventory) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '거래 제안하기',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _targetNameController,
              decoration: const InputDecoration(
                labelText: '거래 대상 캐릭터 이름',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.person),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _goldController,
              decoration: const InputDecoration(
                labelText: '제시할 골드',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.attach_money),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            const Text('제시할 아이템:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              height: 200,
              child: inventory.isEmpty
                  ? const Center(child: Text('인벤토리가 비어있습니다'))
                  : ListView.builder(
                      itemCount: inventory.length,
                      itemBuilder: (context, index) {
                        final item = inventory[index];
                        final isSelected = _selectedItems.contains(item.itemId);
                        return CheckboxListTile(
                          title: Text('${item.name} x${item.qty}'),
                          value: isSelected,
                          onChanged: (checked) {
                            setState(() {
                              if (checked == true) {
                                _selectedItems.add(item.itemId);
                              } else {
                                _selectedItems.remove(item.itemId);
                              }
                            });
                          },
                        );
                      },
                    ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                final targetName = _targetNameController.text.trim();
                final gold = int.tryParse(_goldController.text) ?? 0;

                if (targetName.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('거래 대상을 입력하세요')),
                  );
                  return;
                }

                session.sendTradeOffer(
                  targetName: targetName,
                  offeredItems: _selectedItems.map((id) {
                    final item = inventory.firstWhere((i) => i.itemId == id);
                    return {'itemId': id, 'qty': item.qty};
                  }).toList(),
                  offeredGold: gold,
                );

                _targetNameController.clear();
                _goldController.clear();
                _selectedItems.clear();
                setState(() {});

                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('거래 제안을 보냈습니다')),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber[700],
                minimumSize: const Size(double.infinity, 48),
              ),
              child: const Text('거래 제안 보내기'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTradesSection(SessionState session) {
    final inbox = session.tradeInbox;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '받은 거래 제안',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            if (inbox.isEmpty)
            const Center(
              child: Text('받은 거래 제안이 없습니다', style: TextStyle(color: Colors.grey)),
              )
            else
              ...inbox.map((o) {
                final offerId = o['offerId']?.toString() ?? '';
                final fromName = o['fromName']?.toString() ?? '???';
                final gold = (o['offeredGold'] is int) ? o['offeredGold'] as int : int.tryParse(o['offeredGold']?.toString() ?? '0') ?? 0;
                final items = (o['offeredItems'] as List?) ?? const [];
                final itemSummary = items.isEmpty
                    ? '아이템 없음'
                    : items.map((it) => '${it['itemId']} x${it['qty']}').join(', ');

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('from: $fromName', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text('gold: $gold'),
                        Text('items: $itemSummary', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                        const SizedBox(height: 6),
                        Text('offerId: $offerId', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: offerId.isEmpty ? null : () => session.tradeAccept(offerId),
                                style: ElevatedButton.styleFrom(backgroundColor: Colors.green[700]),
                                child: const Text('수락'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: offerId.isEmpty ? null : () => session.tradeReject(offerId),
                                style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700]),
                                child: const Text('거절'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
          ],
        ),
      ),
    );
  }
}

