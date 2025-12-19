import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';
import '../../core/request_tracker.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final Map<String, bool> _buyingItems = {}; // 구매 중인 아이템 추적

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Consumer<SessionState>(
          builder: (context, session, _) {
            final shop = session.activeShop;
            return Text(shop?.title ?? '🏪 상점');
          },
        ),
        actions: [
          // 골드 표시
          Consumer<SessionState>(
            builder: (context, session, _) {
              final gold = session.gameState.gold ?? 0;
              return Padding(
                padding: const EdgeInsets.all(16.0),
                child: Center(
                  child: Text(
                    '💰 ${gold}G',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Colors.amber,
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<SessionState>(
        builder: (context, session, _) {
          // 로딩 중
          if (session.shopLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          // 상점 없음
          if (session.activeShop == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.store_mall_directory_outlined, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text(
                    '이 방에는 상점이 없습니다.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('돌아가기'),
                  ),
                ],
              ),
            );
          }

          final shop = session.activeShop!;
          
          // 상점 목록
          if (shop.items.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    '판매 중인 상품이 없습니다.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('돌아가기'),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: shop.items.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final item = shop.items[index];
              final isBuying = _buyingItems[item.itemId] ?? false;
              
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                elevation: 2,
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: Icon(
                    _getItemIcon(item),
                    size: 40,
                    color: _getItemColor(item),
                  ),
                  title: Text(
                    item.name,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: _buildPriceWidget(context, session, item),
                  trailing: isBuying
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : _buildBuyButton(context, session, item),
                ),
              );
            },
          );
        },
      ),
    );
  }

  IconData _getItemIcon(ShopItemView item) {
    // itemId 기반으로 아이콘 추론
    final id = item.itemId.toLowerCase();
    if (id.contains('weapon') || id.contains('sword') || id.contains('dagger') || id.contains('blade')) {
      return Icons.sports_kabaddi;
    } else if (id.contains('body') || id.contains('armor') || id.contains('coat')) {
      return Icons.shield;
    } else if (id.contains('acc') || id.contains('ring') || id.contains('pendant') || id.contains('charm') || id.contains('sigil')) {
      return Icons.stars;
    } else if (id.contains('potion') || id.contains('consumable')) {
      return Icons.local_drink;
    } else if (id.contains('stamp') || id.contains('seal')) {
      return Icons.verified;
    } else if (id.contains('material') || id.contains('mat')) {
      return Icons.inventory_2;
    }
    return Icons.shopping_bag;
  }

  Color _getItemColor(ShopItemView item) {
    final id = item.itemId.toLowerCase();
    if (id.contains('weapon') || id.contains('sword') || id.contains('dagger') || id.contains('blade')) {
      return Colors.red;
    } else if (id.contains('body') || id.contains('armor') || id.contains('coat')) {
      return Colors.blue;
    } else if (id.contains('acc') || id.contains('ring') || id.contains('pendant') || id.contains('charm') || id.contains('sigil')) {
      return Colors.purple;
    } else if (id.contains('potion') || id.contains('consumable')) {
      return Colors.green;
    } else if (id.contains('stamp') || id.contains('seal')) {
      return Colors.amber;
    }
    return Colors.grey;
  }

  Widget _buildPriceWidget(BuildContext context, SessionState session, ShopItemView item) {
    if (item.isGoldShop) {
      // 골드 상점
      return Padding(
        padding: const EdgeInsets.only(top: 4.0),
        child: Text(
          '가격: ${item.priceGold}G',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.amber,
          ),
        ),
      );
    } else if (item.isCostItemShop) {
      // 아이템 화폐 상점 (인장 등)
      return Padding(
        padding: const EdgeInsets.only(top: 4.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: item.costItems.map((cost) {
            final have = session.gameState.getItemQty(cost.itemId);
            final need = cost.qty;
            final itemName = session.gameState.getItemName(cost.itemId) ?? _getItemFallbackName(cost.itemId);
            final isEnough = have >= need;
            
            return Padding(
              padding: const EdgeInsets.only(top: 2.0),
              child: Row(
                children: [
                  Icon(
                    isEnough ? Icons.check_circle : Icons.cancel,
                    size: 14,
                    color: isEnough ? Colors.green : Colors.red,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '$itemName: $have/$need',
                      style: TextStyle(
                        fontSize: 12,
                        color: isEnough ? Colors.green : Colors.red,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      );
    } else {
      return const Text(
        '가격 정보 없음',
        style: TextStyle(fontSize: 12, color: Colors.grey),
      );
    }
  }

  Widget _buildBuyButton(BuildContext context, SessionState session, ShopItemView item) {
    final canBuy = _canBuy(session, item);
    
    return ElevatedButton(
      onPressed: canBuy ? () => _showBuyDialog(context, session, item) : null,
      style: ElevatedButton.styleFrom(
        backgroundColor: canBuy ? Colors.green[700] : Colors.grey,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      child: const Text('구매'),
    );
  }

  bool _canBuy(SessionState session, ShopItemView item) {
    if (item.isGoldShop) {
      final gold = session.gameState.gold ?? 0;
      return gold >= item.priceGold;
    } else if (item.isCostItemShop) {
      for (final cost in item.costItems) {
        final have = session.gameState.getItemQty(cost.itemId);
        if (have < cost.qty) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  void _showBuyDialog(BuildContext context, SessionState session, ShopItemView item) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('${item.name} 구매'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '구매하시겠습니까?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            const Text('비용:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            if (item.isGoldShop)
              Text('  💰 ${item.priceGold}G', style: const TextStyle(fontSize: 14))
            else if (item.isCostItemShop)
              ...item.costItems.map((cost) {
                final itemName = session.gameState.getItemName(cost.itemId) ?? _getItemFallbackName(cost.itemId);
                return Padding(
                  padding: const EdgeInsets.only(left: 8.0, top: 2.0),
                  child: Text('  • $itemName x${cost.qty}', style: const TextStyle(fontSize: 14)),
                );
              }),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              _buyItem(session, item);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green[700],
              foregroundColor: Colors.white,
            ),
            child: const Text('구매'),
          ),
        ],
      ),
    );
  }

  void _buyItem(SessionState session, ShopItemView item) async {
    // 이미 구매 중이면 무시 (중복 클릭 방지)
    if (_buyingItems[item.itemId] == true) {
      return;
    }
    
    setState(() {
      _buyingItems[item.itemId] = true;
    });

    try {
      // OK/ERR 기반 구매 요청
      final result = await session.shopBuy(item.itemId);
      
      if (!mounted) return;
      
      // 성공 메시지
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ ${item.name} 구매 완료!'),
          backgroundColor: Colors.green[700],
          duration: const Duration(seconds: 2),
        ),
      );
      
      // 디버그 로그
      if (kDebugMode) {
        print('[ShopBuy] 구매 성공: ${result.itemId} x${result.qty}');
        print('[ShopBuy] balances: ${result.balances}');
      }
    } catch (e) {
      if (!mounted) return;
      
      // 에러 메시지 표시
      String userMessage;
      if (e is ShopBuyError) {
        userMessage = e.toUserMessage();
        if (kDebugMode) {
          print('[ShopBuy] 구매 실패: ${e.code} - ${e.message}');
        }
      } else {
        userMessage = e.toString();
        if (kDebugMode) {
          print('[ShopBuy] 예외 발생: $e');
        }
      }
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ $userMessage'),
          backgroundColor: Colors.red[700],
          duration: const Duration(seconds: 3),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _buyingItems[item.itemId] = false;
        });
      }
    }
  }

  String _getItemFallbackName(String itemId) {
    // 인장/스탬프 최소 매핑
    const fallbackMap = {
      'ITEM_LEDGER_SEAL_S1': '장부 인장(S1)',
      'ITEM_LEDGER_STAMP_S1': '장부 스탬프(S1)',
      'ITEM_POTION_HP_S': '체력 포션(소)',
      'ITEM_POTION_HP_M': '체력 포션(중)',
      'ITEM_POTION_HP_L': '체력 포션(대)',
    };
    return fallbackMap[itemId] ?? itemId;
  }
}
