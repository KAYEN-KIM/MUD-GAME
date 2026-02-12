import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models.dart';
import '../../core/models_extended.dart';

class DungeonScreen extends StatefulWidget {
  const DungeonScreen({Key? key}) : super(key: key);

  @override
  State<DungeonScreen> createState() => _DungeonScreenState();
}

class _DungeonScreenState extends State<DungeonScreen> {
  String? _selectedDifficulty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = Provider.of<SessionState>(context, listen: false);
      session.requestDungeonList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final dungeons = session.availableDungeons;

    return Scaffold(
      appBar: AppBar(
        title: const Text('던전'),
        backgroundColor: Colors.red[700],
      ),
      body: dungeons.isEmpty
          ? const Center(child: Text('던전을 불러오는 중...'))
          : ListView.builder(
              itemCount: dungeons.length,
              padding: const EdgeInsets.all(12),
              itemBuilder: (context, index) {
                return _buildDungeonCard(dungeons[index], session);
              },
            ),
    );
  }

  Widget _buildDungeonCard(DungeonView dungeon, SessionState session) {
    final characterLevel = session.gameState.level ?? 1;
    final canEnter = characterLevel >= dungeon.minLevel;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: Icon(
          Icons.castle,
          color: canEnter ? Colors.red[700] : Colors.grey,
          size: 32,
        ),
        title: Text(
          dungeon.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          '최소 레벨: ${dungeon.minLevel} | 추천: ${dungeon.recommendedLevel}\n파티 크기: ${dungeon.maxPartySize}명',
          style: const TextStyle(fontSize: 11),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dungeon.description,
                  style: const TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 12),
                const Text(
                  '난이도 선택:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: dungeon.difficulties.map((diff) {
                    return ChoiceChip(
                      label: Text(_getDifficultyName(diff)),
                      selected: _selectedDifficulty == diff,
                      onSelected: canEnter
                          ? (selected) {
                              setState(() {
                                _selectedDifficulty = selected ? diff : null;
                              });
                            }
                          : null,
                      selectedColor: _getDifficultyColor(diff),
                      labelStyle: TextStyle(
                        color: _selectedDifficulty == diff ? Colors.white : Colors.black87,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: canEnter && _selectedDifficulty != null
                      ? () {
                          session.enterDungeon(dungeonId: dungeon.id, difficulty: _selectedDifficulty!);
                          Navigator.pop(context);
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red[700],
                    minimumSize: const Size(double.infinity, 44),
                  ),
                  child: Text(
                    canEnter
                        ? (_selectedDifficulty != null ? '던전 입장' : '난이도를 선택하세요')
                        : '레벨 부족 (Lv.${dungeon.minLevel} 필요)',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getDifficultyName(String difficulty) {
    switch (difficulty) {
      case 'NORMAL':
        return '노말';
      case 'HARD':
        return '하드';
      case 'HELL':
        return '헬';
      default:
        return difficulty;
    }
  }

  Color _getDifficultyColor(String difficulty) {
    switch (difficulty) {
      case 'NORMAL':
        return Colors.green;
      case 'HARD':
        return Colors.orange;
      case 'HELL':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}

