import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';

class PartyScreen extends StatefulWidget {
  const PartyScreen({super.key});

  @override
  State<PartyScreen> createState() => _PartyScreenState();
}

class _PartyScreenState extends State<PartyScreen> {
  final TextEditingController _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🎉 파티'),
      ),
      body: Consumer<SessionState>(
        builder: (context, session, _) {
          final party = session.partyInfo;
          final isInParty = session.isInParty;

          if (isInParty && party != null) {
            return _buildPartyView(context, session, party);
          } else {
            return _buildNoPartyView(context, session);
          }
        },
      ),
    );
  }

  Widget _buildNoPartyView(BuildContext context, SessionState session) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            '파티가 없습니다',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              session.partyCreate();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('파티 생성 중...')),
              );
            },
            icon: const Icon(Icons.group_add),
            label: const Text('파티 생성'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[700],
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 16),
          const Text(
            '초대 코드로 가입',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _codeController,
            decoration: const InputDecoration(
              hintText: '6자리 초대 코드 입력',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.characters,
            maxLength: 6,
          ),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: () {
              final code = _codeController.text.trim().toUpperCase();
              if (code.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('초대 코드를 입력하세요.')),
                );
                return;
              }
              session.partyJoin(code);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('파티 가입 요청: $code')),
              );
              _codeController.clear();
            },
            icon: const Icon(Icons.login),
            label: const Text('가입'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green[700],
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPartyView(BuildContext context, SessionState session, dynamic party) {
    final isLeader = session.isPartyLeader;
    final myCharId = session.gameState.characterId;

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        '초대 코드:',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        party.code,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: party.code));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('초대 코드 복사됨')),
                          );
                        },
                        icon: const Icon(Icons.copy),
                        tooltip: '복사',
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '파티원: ${party.memberCount}/4',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            '파티원 목록',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              itemCount: party.members.length,
              itemBuilder: (context, index) {
                final member = party.members[index];
                final isSelf = member.characterId == myCharId;
                final isMemberLeader = member.characterId == party.leaderCharacterId;

                return Card(
                  color: isSelf ? Colors.blue[50] : null,
                  child: ListTile(
                    leading: Icon(
                      isMemberLeader ? Icons.star : Icons.person,
                      color: isMemberLeader ? Colors.amber : Colors.grey,
                    ),
                    title: Text(
                      member.name + (isSelf ? ' (나)' : ''),
                      style: TextStyle(
                        fontWeight: isSelf ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    subtitle: Text('Lv.${member.level} | ${member.roomId}'),
                    trailing: isMemberLeader
                        ? const Chip(
                            label: Text('리더', style: TextStyle(fontSize: 10)),
                            backgroundColor: Colors.amber,
                          )
                        : null,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('파티 나가기'),
                  content: Text(
                    isLeader
                        ? '리더가 나가면 파티가 해산되거나 다음 멤버가 리더가 됩니다.'
                        : '파티를 나가시겠습니까?',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('취소'),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        session.partyLeave();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('파티 나가기 요청...')),
                        );
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                      child: const Text('나가기'),
                    ),
                  ],
                ),
              );
            },
            icon: const Icon(Icons.exit_to_app),
            label: const Text('파티 나가기'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[700],
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }
}

