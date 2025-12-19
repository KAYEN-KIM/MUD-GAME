import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';

class ActionBar extends StatefulWidget {
  const ActionBar({super.key});

  @override
  State<ActionBar> createState() => _ActionBarState();
}

class _ActionBarState extends State<ActionBar> {

  bool _canRest(SessionState session) {
    // SAFE 태그 기반 판정 (서버 권위, fallback 제거)
    final roomTags = session.gameState.roomTags;
    return roomTags != null && roomTags.contains('SAFE');
  }

  void _handleRest(BuildContext context, SessionState session) {
    session.send('REST', {});
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('휴식 중...'), duration: Duration(seconds: 1)),
    );
  }

  Future<void> _showMoveDirDialog(BuildContext context) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('이동 (개발자 모드)'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'N, S, E, W, U, D',
            border: OutlineInputBorder(),
          ),
          maxLength: 1,
          textCapitalization: TextCapitalization.characters,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () {
              final dir = controller.text.trim().toUpperCase();
              if (['N', 'S', 'E', 'W', 'U', 'D'].contains(dir)) {
                Navigator.pop(context, dir);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('N, S, E, W, U, D만 입력 가능합니다.')),
                );
              }
            },
            child: const Text('이동'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty && context.mounted) {
      context.read<SessionState>().moveDir(result);
    }
  }

  Future<void> _showMoveRoomIdDialog(BuildContext context) async {
    final controller = TextEditingController(text: 'R1_00');
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('이동 (개발자 모드)'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'N/E/S/W/U/D 또는 룸 ID (예: R1_00)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('이동'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty && context.mounted) {
      final session = context.read<SessionState>();
      
      // 이동 쿨다운 체크
      if (session.isMoveLocked) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('⏳ 이동 쿨다운 중...'), duration: Duration(seconds: 1)),
        );
        return;
      }
      
      final input = result.trim().toUpperCase();
      // N/E/S/W/U/D면 exits 기반 이동, 그 외는 toRoomId로 처리
      if (['N', 'S', 'E', 'W', 'U', 'D'].contains(input)) {
        session.moveDirByExits(input);
      } else {
        session.moveByRoomId(result.trim());
      }
    }
  }

  Future<void> _showChatDialog(BuildContext context) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('채팅 메시지'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: '메시지를 입력하세요',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('전송'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty && context.mounted) {
      context.read<SessionState>().chatSend(result);
    }
  }

  Future<void> _showCombatDialog(BuildContext context) async {
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('전투 행동 선택'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.flash_on, color: Colors.red),
              title: const Text('공격 (ATTACK)'),
              onTap: () => Navigator.pop(context, 'ATTACK'),
            ),
            ListTile(
              leading: const Icon(Icons.shield, color: Colors.blue),
              title: const Text('방어 (DEFEND)'),
              onTap: () => Navigator.pop(context, 'DEFEND'),
            ),
            ListTile(
              leading: const Icon(Icons.directions_run, color: Colors.orange),
              title: const Text('후퇴 (RETREAT)'),
              onTap: () => Navigator.pop(context, 'RETREAT'),
            ),
          ],
        ),
      ),
    );

    if (result != null && context.mounted) {
      context.read<SessionState>().combatTurn(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        return Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.grey[200],
            border: Border(top: BorderSide(color: Colors.grey[400]!)),
          ),
          child: Column(
            children: [
              // 액션 버튼
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => session.partyCreate(),
                    icon: const Icon(Icons.group_add, size: 16),
                    label: const Text('파티 생성'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  if (session.developerMode)
                    ElevatedButton.icon(
                      onPressed: () => _showMoveRoomIdDialog(context),
                      icon: const Icon(Icons.directions_walk, size: 16),
                      label: const Text('룸 ID 이동'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  if (session.developerMode)
                    ElevatedButton.icon(
                      onPressed: () => _showMoveDirDialog(context),
                      icon: const Icon(Icons.navigation, size: 16),
                      label: const Text('방향 이동'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  // REST 버튼 (SAFE 방에서만 활성화)
                  ElevatedButton.icon(
                    onPressed: _canRest(session) ? () => _handleRest(context, session) : null,
                    icon: const Icon(Icons.hotel, size: 16),
                    label: const Text('휴식(REST)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => session.hunt(),
                    icon: const Icon(Icons.search, size: 16),
                    label: const Text('사냥'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _showCombatDialog(context),
                    icon: const Icon(Icons.sports_kabaddi, size: 16),
                    label: const Text('전투'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _showChatDialog(context),
                    icon: const Icon(Icons.chat, size: 16),
                    label: const Text('채팅'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

