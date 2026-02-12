import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';
import '../../core/models_extended.dart';

class SkillScreen extends StatefulWidget {
  const SkillScreen({Key? key}) : super(key: key);

  @override
  State<SkillScreen> createState() => _SkillScreenState();
}

class _SkillScreenState extends State<SkillScreen> {
  String _selectedCategory = 'COMBAT';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = Provider.of<SessionState>(context, listen: false);
      session.requestSkillList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final skills = session.availableSkills
        .where((s) => s.category == _selectedCategory)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('스킬'),
        backgroundColor: Colors.deepPurple,
      ),
      body: Column(
        children: [
          _buildCategoryTabs(),
          _buildSkillPointsInfo(session),
          Expanded(
            child: skills.isEmpty
                ? const Center(child: Text('스킬을 불러오는 중...'))
                : ListView.builder(
                    itemCount: skills.length,
                    itemBuilder: (context, index) {
                      return _buildSkillCard(skills[index], session);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final categories = [
      {'id': 'COMBAT', 'name': '전투', 'icon': Icons.sports_martial_arts},
      {'id': 'DEFENSE', 'name': '방어', 'icon': Icons.shield},
      {'id': 'SUPPORT', 'name': '지원', 'icon': Icons.healing},
      {'id': 'UTILITY', 'name': '유틸', 'icon': Icons.build},
    ];

    return Container(
      color: Colors.grey[200],
      child: Row(
        children: categories.map((cat) {
          final isSelected = _selectedCategory == cat['id'];
          return Expanded(
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedCategory = cat['id'] as String;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.deepPurple : Colors.transparent,
                  border: Border(
                    bottom: BorderSide(
                      color: isSelected ? Colors.deepPurple : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      cat['icon'] as IconData,
                      color: isSelected ? Colors.white : Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      cat['name'] as String,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey[800],
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSkillPointsInfo(SessionState session) {
    final skillPoints = session.gameState.skillPoints ?? 0;

    return Container(
      padding: const EdgeInsets.all(12),
      color: Colors.amber[50],
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.star, color: Colors.amber, size: 20),
          const SizedBox(width: 8),
          Text(
            '스킬 포인트: $skillPoints',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSkillCard(SkillView skill, SessionState session) {
    final canLearn = skill.canLearn && skill.currentLevel < skill.maxLevel;
    final isMaxLevel = skill.currentLevel >= skill.maxLevel;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ExpansionTile(
        leading: _getSkillIcon(skill.type),
        title: Text(
          '${skill.name} ${skill.currentLevel > 0 ? "Lv.${skill.currentLevel}" : ""}',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: skill.currentLevel > 0 ? Colors.green[700] : Colors.black87,
          ),
        ),
        subtitle: Text(
          '${skill.type} • 요구 레벨: ${skill.requiredLevel}',
          style: const TextStyle(fontSize: 11),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(skill.description),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: skill.currentLevel / skill.maxLevel,
                  backgroundColor: Colors.grey[300],
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.deepPurple),
                ),
                const SizedBox(height: 4),
                Text(
                  '레벨: ${skill.currentLevel}/${skill.maxLevel}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
                if (skill.requiredSkills != null && skill.requiredSkills!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      '선행 스킬 필요: ${skill.requiredSkills!.map((s) => "${s['skillId']} Lv.${s['level']}").join(", ")}',
                      style: const TextStyle(fontSize: 10, color: Colors.orange),
                    ),
                  ),
                const SizedBox(height: 12),
                if (isMaxLevel)
                  const Center(
                    child: Text(
                      '최대 레벨 달성',
                      style: TextStyle(
                        color: Colors.green,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  )
                else
                  ElevatedButton(
                    onPressed: canLearn
                        ? () {
                            session.learnSkill(skillId: skill.id);
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepPurple,
                      minimumSize: const Size(double.infinity, 40),
                    ),
                    child: Text(
                      canLearn
                          ? '스킬 배우기 (SP -1)'
                          : skill.currentLevel == 0
                              ? '요구사항 미충족'
                              : '레벨업 (SP -1)',
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _getSkillIcon(String type) {
    switch (type) {
      case 'PASSIVE':
        return const Icon(Icons.psychology, color: Colors.blue);
      case 'ACTIVE':
        return const Icon(Icons.flash_on, color: Colors.orange);
      case 'TOGGLE':
        return const Icon(Icons.toggle_on, color: Colors.green);
      default:
        return const Icon(Icons.help_outline, color: Colors.grey);
    }
  }
}

