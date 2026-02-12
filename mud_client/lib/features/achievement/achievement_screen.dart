import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models_extended.dart';

class AchievementScreen extends StatefulWidget {
  const AchievementScreen({Key? key}) : super(key: key);

  @override
  State<AchievementScreen> createState() => _AchievementScreenState();
}

class _AchievementScreenState extends State<AchievementScreen> {
  String _selectedCategory = 'ALL';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = Provider.of<SessionState>(context, listen: false);
      session.requestAchievements();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final achievements = session.availableAchievements;
    final filtered = _selectedCategory == 'ALL'
        ? achievements
        : achievements.where((a) => a.category == _selectedCategory).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('업적 & 칭호'),
        backgroundColor: Colors.indigo[700],
      ),
      body: Column(
        children: [
          _buildCategoryTabs(),
          _buildTitleDisplay(session),
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      return _buildAchievementCard(filtered[index], session);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final categories = [
      {'id': 'ALL', 'name': '전체', 'icon': Icons.all_inclusive},
      {'id': 'COMBAT', 'name': '전투', 'icon': Icons.sports_martial_arts},
      {'id': 'EXPLORATION', 'name': '탐험', 'icon': Icons.explore},
      {'id': 'CRAFTING', 'name': '제작', 'icon': Icons.construction},
      {'id': 'SOCIAL', 'name': '사교', 'icon': Icons.people},
    ];

    return Container(
      color: Colors.grey[200],
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: categories.map((cat) {
            final isSelected = _selectedCategory == cat['id'];
            return InkWell(
              onTap: () {
                setState(() {
                  _selectedCategory = cat['id'] as String;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.indigo[700] : Colors.transparent,
                  border: Border(
                    bottom: BorderSide(
                      color: isSelected ? Colors.indigo : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      cat['icon'] as IconData,
                      color: isSelected ? Colors.white : Colors.grey[600],
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      cat['name'] as String,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey[800],
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTitleDisplay(SessionState session) {
    final currentTitle = session.gameState.currentTitle ?? '칭호 없음';

    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.indigo[50],
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.star, color: Colors.amber),
          const SizedBox(width: 8),
          const Text(
            '현재 칭호: ',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Text(
            currentTitle,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.indigo[700],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementCard(AchievementView achievement, SessionState session) {
    final progress = achievement.progress;
    final maxProgress = achievement.maxProgress;
    final progressPercent = maxProgress > 0 ? progress / maxProgress : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: achievement.completed ? Colors.green[50] : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  achievement.completed ? Icons.check_circle : Icons.circle_outlined,
                  color: achievement.completed ? Colors.green : Colors.grey,
                  size: 32,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        achievement.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        achievement.description,
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: progressPercent,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(
                achievement.completed ? Colors.green : Colors.indigo,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '진행도: $progress/$maxProgress',
              style: const TextStyle(fontSize: 11),
            ),
            if (achievement.rewards != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber[50],
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.card_giftcard, size: 16, color: Colors.amber),
                    const SizedBox(width: 8),
                    Text(
                      '보상: ${_formatRewards(achievement.rewards!)}',
                      style: const TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
            if (achievement.completed && achievement.completedAt == null) ...[
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  session.claimAchievement(achievementId: achievement.id);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo[700],
                  minimumSize: const Size(double.infinity, 40),
                ),
                child: const Text('보상 받기'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatRewards(Map<String, dynamic> rewards) {
    final parts = <String>[];
    if (rewards['gold'] != null) parts.add('${rewards['gold']} 골드');
    if (rewards['exp'] != null) parts.add('${rewards['exp']} 경험치');
    if (rewards['title'] != null) parts.add('칭호: ${rewards['title']}');
    return parts.join(', ');
  }
}

