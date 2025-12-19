import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';
import '../../services/item_catalog.dart';
import '../auth/auth_screen.dart';
import '../settings/settings_screen.dart';
import '../inventory/inventory_screen.dart';
import '../shop/shop_screen.dart';
import '../quest/quest_screen.dart';
import '../party/party_screen.dart';
import 'widgets/log_view.dart';
import 'widgets/quest_mini_tracker.dart';
import 'widgets/action_bar.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MUD Client'),
        actions: [
          Consumer<SessionState>(
            builder: (context, session, _) {
              final isConnected = session.connectionStatus == ConnectionStatus.connected;
              final isReconnecting = session.connectionStatus == ConnectionStatus.reconnecting;
              
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(
                      isConnected ? Icons.link : Icons.link_off,
                      color: isConnected ? Colors.green : Colors.red,
                    ),
                    onPressed: isConnected
                        ? () => _disconnect(context)
                        : () => _connect(context),
                    tooltip: isConnected ? 'Disconnect' : 'Connect',
                  ),
                  if (isReconnecting)
                    IconButton(
                      icon: const Icon(Icons.refresh, color: Colors.orange),
                      onPressed: () {
                        session.manualReconnect();
                      },
                      tooltip: 'Manual Reconnect',
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.inventory),
            tooltip: '인벤토리 & 장비',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const InventoryScreen()),
              );
            },
          ),
          Consumer<SessionState>(
            builder: (context, session, _) {
              // 상점이 있거나 로딩 중일 때만 버튼 표시
              if (!session.isShopAvailable && !session.shopLoading) {
                return const SizedBox.shrink();
              }
              
              return IconButton(
                icon: session.shopLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.shopping_cart),
                tooltip: session.activeShop?.title ?? '상점',
                onPressed: session.shopLoading
                    ? null
                    : () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ShopScreen()),
                        );
                      },
              );
            },
          ),
          Consumer<SessionState>(
            builder: (context, session, _) {
              final completedCount = session.completedQuestsCount;
              
              return Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.assignment),
                    tooltip: '퀘스트',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const QuestScreen()),
                      );
                    },
                  ),
                  if (completedCount > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '$completedCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.group),
            tooltip: '파티',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PartyScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // 사망 배너 (최우선)
          Consumer<SessionState>(
            builder: (context, session, _) {
              final recentDeathLog = session.logs
                  .where((log) => log.content.toLowerCase().contains('사망'))
                  .toList();
              
              if (recentDeathLog.isNotEmpty && recentDeathLog.length > 0) {
                // 최근 5초 이내 사망 로그가 있으면 배너 표시
                return Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  color: Colors.red[700],
                  child: Row(
                    children: [
                      const Icon(Icons.warning, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '💀 사망! START_TOWN에서 부활했습니다. (골드 -10%)',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white, size: 18),
                        onPressed: () {
                          // 배너 숨기기 (로그에서 제거는 안 함)
                          // 실제로는 별도 상태로 관리하는 게 좋지만, 단순화
                        },
                      ),
                    ],
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          // HUD 상태 표시
          Consumer<SessionState>(
            builder: (context, session, _) {
              final gs = session.gameState;
              final connStatus = session.connectionStatus;
              
              // 연결 상태 색상
              Color statusColor = Colors.grey;
              switch (connStatus) {
                case ConnectionStatus.connecting:
                  statusColor = Colors.orange;
                  break;
                case ConnectionStatus.connected:
                  statusColor = Colors.green;
                  break;
                case ConnectionStatus.disconnected:
                  statusColor = Colors.red;
                  break;
                case ConnectionStatus.reconnecting:
                  statusColor = Colors.amber;
                  break;
              }
              
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  border: Border(
                    bottom: BorderSide(color: Colors.blue[200]!),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 연결 상태
                    Row(
                      children: [
                        Icon(
                          connStatus == ConnectionStatus.connected
                              ? Icons.link
                              : Icons.link_off,
                          size: 14,
                          color: statusColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          session.connectionStatusText,
                          style: TextStyle(
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: statusColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // 캐릭터 정보
                    Row(
                      children: [
                        Text(
                          gs.characterName ?? '(캐릭터 없음)',
                          style: TextStyle(
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: Colors.blue[900],
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Lv.${gs.level ?? 0}',
                          style: TextStyle(
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: Colors.blue[700],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'HP: ${gs.hp ?? 0}/${gs.hpMax ?? 0}',
                          style: TextStyle(
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: (gs.hp != null && gs.hpMax != null && gs.hp! < gs.hpMax! * 0.3)
                                ? Colors.red[700]
                                : Colors.green[700],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // 코스메틱 정보
                    if (gs.cosmeticTitleItemId != null || gs.cosmeticIconItemId != null)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (gs.cosmeticTitleItemId != null)
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '칭호: ${_getItemName(gs.cosmeticTitleItemId)}',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontFamily: 'monospace',
                                      color: Colors.purple[700],
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  height: 20,
                                  child: ElevatedButton(
                                    onPressed: () => _unequipCosmetic(context, 'title'),
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
                                      minimumSize: Size.zero,
                                      backgroundColor: Colors.red[100],
                                      foregroundColor: Colors.red[700],
                                      textStyle: const TextStyle(fontSize: 8),
                                    ),
                                    child: const Text('해제'),
                                  ),
                                ),
                              ],
                            ),
                          if (gs.cosmeticIconItemId != null)
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '아이콘: ${_getItemName(gs.cosmeticIconItemId)}',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontFamily: 'monospace',
                                      color: Colors.orange[700],
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  height: 20,
                                  child: ElevatedButton(
                                    onPressed: () => _unequipCosmetic(context, 'icon'),
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
                                      minimumSize: Size.zero,
                                      backgroundColor: Colors.red[100],
                                      foregroundColor: Colors.red[700],
                                      textStyle: const TextStyle(fontSize: 8),
                                    ),
                                    child: const Text('해제'),
                                  ),
                                ),
                              ],
                            ),
                          const SizedBox(height: 4),
                        ],
                      ),
                    // 현재 방
                    Text(
                      '현재 방: ${gs.roomId ?? "(미확인)"}',
                      style: TextStyle(
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: Colors.blue[700],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 방향 이동 패널 (dir 기반 하이브리드)
                    _buildDirectionalMovementPanel(session),
                    // 출구 이동 패널 (항상 표시)
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.blue[200]!),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              children: [
                                Icon(Icons.place, size: 14, color: Colors.blue[800]),
                                const SizedBox(width: 4),
                                Text(
                                  '출구 이동',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontFamily: 'monospace',
                                    color: Colors.blue[800],
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (session.gameState.exits != null && session.gameState.exits!.isNotEmpty)
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: session.gameState.exits!.map((exit) {
                                  final isLocked = session.isMoveLocked;
                                  final trimmedLabel = exit.label.trim();
                                  return ActionChip(
                                    label: Text(trimmedLabel, style: const TextStyle(fontSize: 11)),
                                    onPressed: isLocked ? null : () => session.moveByRoomId(exit.toRoomId),
                                    backgroundColor: isLocked ? Colors.grey[300] : Colors.blue[100],
                                    disabledColor: Colors.grey[300],
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  );
                                }).toList(),
                              ),
                            )
                          else
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Text(
                                '출구 정보 없음 (STATE_SYNC 확인)',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  color: Colors.grey[600],
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'REST: ${session.restUrl ?? "미설정"} | WS: ${session.wsUrl ?? "미설정"}',
                      style: TextStyle(
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: Colors.grey[600],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            },
          ),
          // 퀘스트 미니 트래커
          const QuestMiniTracker(),
          // 로그 뷰
          const Expanded(
            child: LogView(),
          ),
          // 액션 바
          const ActionBar(),
        ],
      ),
    );
  }

  void _connect(BuildContext context) async {
    final session = context.read<SessionState>();
    try {
      await session.connect();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('연결 실패: $e')),
        );
      }
    }
  }

  void _disconnect(BuildContext context) {
    context.read<SessionState>().disconnect();
  }

  void _logout(BuildContext context) async {
    await context.read<SessionState>().logout();
    if (context.mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AuthScreen()),
      );
    }
  }
  
  IconData _getDirectionIcon(String dir) {
    switch (dir) {
      case 'N':
        return Icons.arrow_upward;
      case 'S':
        return Icons.arrow_downward;
      case 'E':
        return Icons.arrow_forward;
      case 'W':
        return Icons.arrow_back;
      case 'U':
        return Icons.arrow_circle_up;
      case 'D':
        return Icons.arrow_circle_down;
      default:
        return Icons.help;
    }
  }
  
  String _getDirectionLabel(String dir) {
    switch (dir) {
      case 'N':
        return '북쪽';
      case 'S':
        return '남쪽';
      case 'E':
        return '동쪽';
      case 'W':
        return '서쪽';
      case 'U':
        return '위';
      case 'D':
        return '아래';
      default:
        return dir;
    }
  }
  
  Widget _buildDirectionalMovementPanel(SessionState session) {
    final exits = session.gameState.exits ?? [];
    final hasDirectionalExit = exits.any((e) => 
      e.dir != null && e.dir!.trim().isNotEmpty
    );
    
    if (!hasDirectionalExit) {
      // 방향 이동을 지원하지 않는 방
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.explore_off, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  '방향 이동',
                  style: TextStyle(
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: Colors.grey[700],
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '이 지역은 방향 이동을 지원하지 않습니다. 아래 출구에서 선택하세요.',
              style: TextStyle(
                fontSize: 8,
                fontFamily: 'monospace',
                color: Colors.grey[600],
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      );
    }
    
    // 방향 이동을 지원하는 방
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: Colors.green[50],
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.green[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                Icon(Icons.explore, size: 14, color: Colors.green[800]),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    '이동 단축키 (출구 단축)',
                    style: TextStyle(
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: Colors.green[800],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: ['N', 'S', 'E', 'W', 'U', 'D'].map((dir) {
                // dir 기반으로 exit 찾기 (정확한 매칭만)
                RoomExit? exit;
                try {
                  exit = exits.firstWhere(
                    (e) => e.dir != null && e.dir!.trim().toUpperCase() == dir,
                  );
                } catch (e) {
                  exit = null;
                }
                
                final hasExit = exit != null;
                final isLocked = session.isMoveLocked;
                final dirKo = _getDirectionLabel(dir);
                
                // 라벨 표시 규칙: "{DIR} · {DIR_KO} ({exit.label})" 또는 "{DIR} · {DIR_KO} (없음)"
                final exitLabelText = hasExit ? exit!.label.trim() : '없음';
                final labelText = '$dir · $dirKo ($exitLabelText)';
                
                return ActionChip(
                  avatar: Icon(_getDirectionIcon(dir), size: 14),
                  label: Text(labelText, style: const TextStyle(fontSize: 10)),
                  onPressed: (isLocked || !hasExit) 
                    ? null 
                    : () => session.moveByRoomId(exit!.toRoomId),
                  backgroundColor: (isLocked || !hasExit) 
                    ? Colors.grey[300] 
                    : Colors.green[100],
                  disabledColor: Colors.grey[300],
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                );
              }).toList(),
            ),
          ),
          if (session.isMoveLocked)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                '이동 중...',
                style: TextStyle(
                  fontSize: 9,
                  color: Colors.orange[800],
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// 아이템 ID를 이름으로 변환 (카탈로그 없으면 itemId 그대로 반환)
  String _getItemName(String? itemId) {
    if (itemId == null || itemId.isEmpty) return '';
    return ItemCatalog.instance.getName(itemId);
  }

  /// 코스메틱 해제 (__UNEQUIP_ICON__ 또는 __UNEQUIP_TITLE__ 전송)
  void _unequipCosmetic(BuildContext context, String type) {
    final session = context.read<SessionState>();
    
    if (type == 'icon') {
      session.send('USE_ITEM', {'itemId': '__UNEQUIP_ICON__', 'qty': 1});
    } else if (type == 'title') {
      session.send('USE_ITEM', {'itemId': '__UNEQUIP_TITLE__', 'qty': 1});
    }
  }
}
