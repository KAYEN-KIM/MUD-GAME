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

  Future<void> _showCastDialog(BuildContext context) async {
    final session = context.read<SessionState>();
    
    // 전투 중인지 확인 (isInCombat 상태, encounterId, 또는 최근 전투 로그)
    bool isInCombat = session.isInCombat;
    
    print('[CAST] _isInCombat: $isInCombat'); // ignore: avoid_print
    print('[CAST] encounterId: ${session.gameState.encounterId}'); // ignore: avoid_print
    
    // encounterId가 있으면 전투 중으로 간주
    if (!isInCombat && session.gameState.encounterId != null) {
      isInCombat = true;
      print('[CAST] encounterId로 전투 중 감지: ${session.gameState.encounterId}'); // ignore: avoid_print
    }
    
    // 최근 5초 이내 전투 로그 확인
    if (!isInCombat && session.logs.isNotEmpty) {
      final now = DateTime.now();
      final recentCombatLogs = session.logs.reversed.take(20).where((log) {
        if (log.type != 'COMBAT' && log.type != 'LOG') return false;
        final timeDiff = now.difference(log.timestamp);
        return timeDiff.inSeconds < 5;
      }).toList();
      
      // "조우했습니다" 또는 "You engage" 메시지 확인
      for (final log in recentCombatLogs) {
        if (log.content.contains('조우했습니다') || 
            (log.content.contains('You engage') && log.content.contains('in combat!'))) {
          isInCombat = true;
          print('[CAST] 로그로 전투 중 감지: ${log.content}'); // ignore: avoid_print
          break;
        }
      }
    }
    
    print('[CAST] 최종 isInCombat: $isInCombat'); // ignore: avoid_print
    
    if (!isInCombat) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ 주문은 전투 중에만 사용할 수 있습니다. 먼저 "사냥" 또는 "공격"으로 전투를 시작하세요.'),
            duration: Duration(seconds: 3),
          ),
        );
      }
      return;
    }
    
    // 현재 전투 중인 몬스터만 찾기 (로그에서 최근 전투 시작 메시지)
    List<String> monsterNames = [];
    List<String> monsterIds = [];
    
    // 최근 로그에서 전투 시작 메시지 찾기 (가장 최근 것만)
    final recentLogs = session.logs.reversed.take(50).toList();
    String? currentMonsterName;
    String? currentMonsterId;
    
    for (final log in recentLogs) {
      // 패턴 1: "You engage Goblin in combat!" (ATTACK 명령)
      if (log.content.contains('You engage') && log.content.contains('in combat!')) {
        final match = RegExp(r'You engage\s+([^in]+?)\s+in combat!').firstMatch(log.content);
        if (match != null) {
          currentMonsterName = match.group(1)?.trim();
          // 이름을 소문자로 변환하여 ID로 사용 (일반적으로 몬스터 ID는 소문자)
          currentMonsterId = currentMonsterName?.toLowerCase();
          break; // 가장 최근 것만 사용
        }
      }
      // 패턴 2: "Goblin과(와) 조우했습니다!" (HUNT 명령)
      else if (log.content.contains('과(와) 조우했습니다!') || log.content.contains('와 조우했습니다!')) {
        final match = RegExp(r'([^과와]+?)\s*과\(와\)?\s*조우했습니다!').firstMatch(log.content);
        if (match != null) {
          currentMonsterName = match.group(1)?.trim();
          currentMonsterId = currentMonsterName?.toLowerCase();
          break; // 가장 최근 것만 사용
        }
      }
      // 패턴 3: "Goblin과(와) 조우했습니다" (변형)
      else if (log.content.contains('조우했습니다')) {
        final match = RegExp(r'([^과와]+?)\s*과\(와\)?\s*조우했습니다').firstMatch(log.content);
        if (match != null) {
          currentMonsterName = match.group(1)?.trim();
          currentMonsterId = currentMonsterName?.toLowerCase();
          break; // 가장 최근 것만 사용
        }
      }
    }
    
    if (currentMonsterName != null && currentMonsterName.isNotEmpty) {
      monsterNames.add(currentMonsterName);
      monsterIds.add(currentMonsterId ?? currentMonsterName?.toLowerCase() ?? '');
    }
    
    String? selectedSpell;
    String? selectedTarget;
    
    final result = await showDialog<Map<String, String?>>(
      context: context,
      barrierDismissible: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('주문 시전'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('주문 선택:', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: selectedSpell,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: '주문을 선택하세요',
                  ),
                    items: const [
                      DropdownMenuItem(
                        value: 'missile',
                        child: Text('Magic Missile (데미지, MP 10)'),
                      ),
                      DropdownMenuItem(
                        value: 'heal',
                        child: Text('Healing Light (회복, MP 15)'),
                      ),
                      DropdownMenuItem(
                        value: 'fireball',
                        child: Text('Fireball (강력한 데미지, MP 25)'),
                      ),
                      DropdownMenuItem(
                        value: 'shield',
                        child: Text('Magic Shield (보호막, MP 20)'),
                      ),
                      DropdownMenuItem(
                        value: 'strength',
                        child: Text('Strength Boost (공격력 증가, MP 15)'),
                      ),
                      DropdownMenuItem(
                        value: 'weakness',
                        child: Text('Weakness (방어력 감소, MP 20)'),
                      ),
                    ],
                  onChanged: (value) {
                    setState(() {
                      selectedSpell = value;
                      // self 타겟 주문: heal, shield, strength
                      if (value == 'heal' || value == 'shield' || value == 'strength') {
                        selectedTarget = 'self';
                      } else {
                        // enemy 타겟 주문: missile, fireball, weakness
                        selectedTarget = null;
                      }
                    });
                  },
                ),
                const SizedBox(height: 24),
                const Text('대상 선택:', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (selectedSpell == 'heal' || selectedSpell == 'shield' || selectedSpell == 'strength')
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                      selectedSpell == 'heal' 
                        ? 'Healing Light는 자신에게 시전됩니다.'
                        : selectedSpell == 'shield'
                          ? 'Magic Shield는 자신에게 시전됩니다.'
                          : 'Strength Boost는 자신에게 시전됩니다.',
                      style: const TextStyle(color: Colors.blue, fontSize: 12),
                    ),
                  )
                else if (selectedSpell == 'missile' || selectedSpell == 'fireball' || selectedSpell == 'weakness')
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (monsterNames.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text(
                            '⚠️ 이 방에는 몬스터가 없습니다.\n다른 방으로 이동하거나 전투를 시작한 후 다시 시도하세요.',
                            style: TextStyle(color: Colors.orange, fontSize: 12),
                          ),
                        )
                      else
                        DropdownButtonFormField<String>(
                          value: selectedTarget,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            hintText: '대상 몬스터를 선택하세요',
                            labelText: '대상 몬스터',
                          ),
                          items: List.generate(monsterNames.length, (index) {
                            final name = monsterNames[index];
                            final id = index < monsterIds.length ? monsterIds[index] : name.toLowerCase();
                            return DropdownMenuItem(
                              value: id,
                              child: Text('$name (Lv.${session.roomMonsters.isNotEmpty && index < session.roomMonsters.length ? session.roomMonsters[index]['level'] ?? '?' : '?'})'),
                            );
                          }),
                          onChanged: (value) {
                            setState(() {
                              selectedTarget = value;
                            });
                          },
                        ),
                    ],
                  ),
                const SizedBox(height: 8),
                if ((selectedSpell == 'missile' || selectedSpell == 'fireball' || selectedSpell == 'weakness') && monsterNames.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                      '💡 현재 전투 중: ${monsterNames.join(", ")}',
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, null),
              child: const Text('취소'),
            ),
            ElevatedButton(
              onPressed: selectedSpell == null || 
                        ((selectedSpell == 'missile' || selectedSpell == 'fireball' || selectedSpell == 'weakness') && selectedTarget == null)
                  ? null
                  : () {
                      String? finalTarget;
                      // self 타겟 주문
                      if (selectedSpell == 'heal' || selectedSpell == 'shield' || selectedSpell == 'strength') {
                        finalTarget = 'self';
                      } 
                      // enemy 타겟 주문
                      else if (selectedSpell == 'missile' || selectedSpell == 'fireball' || selectedSpell == 'weakness') {
                        finalTarget = selectedTarget;
                      }
                      
                      if (finalTarget == null || finalTarget.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('대상을 선택하세요.')),
                        );
                        return;
                      }
                      
                      Navigator.pop(context, {
                        'spell': selectedSpell!,
                        'target': finalTarget,
                      });
                    },
              child: const Text('시전'),
            ),
          ],
        ),
      ),
    );

    if (result != null && context.mounted) {
      session.cast(
        spell: result['spell']!,
        target: result['target'],
      );
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
                  ElevatedButton.icon(
                    onPressed: () => _showCastDialog(context),
                    icon: const Icon(Icons.auto_awesome, size: 16),
                    label: const Text('주문'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
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

