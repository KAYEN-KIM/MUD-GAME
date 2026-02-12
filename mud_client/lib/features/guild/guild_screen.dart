import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models_extended.dart';

class GuildScreen extends StatefulWidget {
  const GuildScreen({Key? key}) : super(key: key);

  @override
  State<GuildScreen> createState() => _GuildScreenState();
}

class _GuildScreenState extends State<GuildScreen> {
  final TextEditingController _guildNameController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = Provider.of<SessionState>(context, listen: false);
      session.requestGuildList();
    });
  }

  @override
  void dispose() {
    _guildNameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('길드'),
        backgroundColor: Colors.purple[700],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCreateGuildSection(session),
            const SizedBox(height: 24),
            _buildGuildListSection(session),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateGuildSection(SessionState session) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '길드 생성',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _guildNameController,
              decoration: const InputDecoration(
                labelText: '길드 이름',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.shield),
              ),
              maxLength: 20,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: '길드 소개',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.description),
              ),
              maxLines: 3,
              maxLength: 200,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                final name = _guildNameController.text.trim();
                final description = _descriptionController.text.trim();

                if (name.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('길드 이름을 입력하세요')),
                  );
                  return;
                }

                session.createGuild(name: name, description: description);

                _guildNameController.clear();
                _descriptionController.clear();

                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('길드를 생성했습니다')),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purple[700],
                minimumSize: const Size(double.infinity, 48),
              ),
              child: const Text('길드 생성하기 (비용: 10,000 골드)'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuildListSection(SessionState session) {
    final guilds = session.availableGuilds;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '길드 목록',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            if (guilds.isEmpty)
              const Center(
                child: Text('길드가 없습니다', style: TextStyle(color: Colors.grey)),
              )
            else
              ...guilds.map((guild) => _buildGuildCard(guild, session)).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildGuildCard(GuildView guild, SessionState session) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const Icon(Icons.shield, size: 40, color: Colors.purple),
        title: Text(
          guild.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          '${guild.description}\n레벨: ${guild.level} | 멤버: ${guild.memberCount}/${guild.maxMembers}\n길드장: ${guild.leaderName}',
          style: const TextStyle(fontSize: 11),
        ),
        isThreeLine: true,
        trailing: ElevatedButton(
          onPressed: () {
            session.joinGuild(guildId: guild.id);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.purple[700],
          ),
          child: const Text('가입'),
        ),
      ),
    );
  }
}

