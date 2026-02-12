import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';

class NPCScreen extends StatefulWidget {
  const NPCScreen({super.key});

  @override
  State<NPCScreen> createState() => _NPCScreenState();
}

class _NPCScreenState extends State<NPCScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionState>().requestNPCList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('NPC 대화'),
      ),
      body: Consumer<SessionState>(
        builder: (context, session, child) {
          // 서버에서 받은 실제 NPC 목록 데이터 사용
          final npcs = session.npcs;
          
          if (npcs.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('NPC 목록을 불러오는 중...'),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16.0),
            itemCount: npcs.length,
            itemBuilder: (context, index) {
              final npc = npcs[index];
              final isAvailable = npc['inCurrentRoom'] as bool? ?? false;
              final roomId = npc['roomId'] as String? ?? '알 수 없음';

              return Card(
                margin: const EdgeInsets.symmetric(vertical: 8.0),
                color: isAvailable ? null : Colors.grey.shade200,
                child: ListTile(
                  leading: Icon(
                    isAvailable ? Icons.person : Icons.person_off,
                    color: isAvailable ? Colors.blue : Colors.grey,
                  ),
                  title: Text(
                    npc['name'] as String,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(npc['title'] as String? ?? ''),
                      Text('위치: $roomId'),
                      const SizedBox(height: 4),
                      Text(
                        npc['description'] as String? ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[700],
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                  trailing: IconButton(
                    icon: Icon(isAvailable ? Icons.chat : Icons.location_off),
                    onPressed: isAvailable
                        ? () {
                            final npcId = npc['id'] as String?;
                            if (npcId != null) {
                              session.talkToNPC(npcId);
                              _showDialogueDialog(context, npc);
                            }
                          }
                        : null,
                    tooltip: isAvailable ? '대화하기' : '현재 방에 없음',
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showDialogueDialog(BuildContext context, Map<String, dynamic> npc) {
    final session = context.read<SessionState>();
    final npcId = npc['id'] as String?;
    final npcName = npc['name'] as String? ?? 'NPC';
    
    // 대화 요청
    if (npcId != null) {
      session.talkToNPC(npcId);
    }
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$npcName와 대화'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                npc['description'] as String? ?? '',
                style: const TextStyle(fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 16),
              const Text(
                '대화 내용은 로그에 표시됩니다.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 8),
              const Text(
                'NPC와 대화하려면 대화 버튼을 눌러주세요.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
        actions: [
          OutlinedButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: const Text('닫기'),
          ),
        ],
      ),
    );
  }
}

