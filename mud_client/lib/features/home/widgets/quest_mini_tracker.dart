import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';
import '../../../core/models/quest_models.dart';

class QuestMiniTracker extends StatelessWidget {
  const QuestMiniTracker({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        final activeQuests = session.activeQuests;
        if (activeQuests.isEmpty) {
          return const SizedBox.shrink();
        }

        // 우선순위: COMPLETED & turninable → COMPLETED → ACTIVE
        final currentRoom = session.gameState.roomId;
        final turninable = activeQuests
            .where((q) => q.status == QuestStatus.completed && q.turninRoomId == currentRoom)
            .toList();
        final completed = activeQuests
            .where((q) => q.status == QuestStatus.completed && q.turninRoomId != currentRoom)
            .toList();
        final active = activeQuests
            .where((q) => q.status == QuestStatus.active)
            .toList();

        final displayQuests = [
          ...turninable,
          ...completed,
          ...active,
        ].take(3).toList();

        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.track_changes, size: 16, color: Colors.blue),
                    const SizedBox(width: 8),
                    const Text(
                      '진행 중 퀘스트',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Text(
                      '${activeQuests.length}개',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...displayQuests.map((quest) => _buildQuestTile(context, session, quest)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuestTile(BuildContext context, SessionState session, QuestActiveView quest) {
    final currentRoom = session.gameState.roomId;
    final canTurnIn = quest.status == QuestStatus.completed && quest.turninRoomId == currentRoom;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _getCadenceIcon(quest.cadence),
                size: 14,
                color: _getCadenceColor(quest.cadence),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  quest.title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (canTurnIn)
                ElevatedButton(
                  onPressed: () {
                    session.questTurnIn(quest.questId);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('${quest.title} 제출 요청...')),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange[700],
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: const Size(0, 0),
                  ),
                  child: const Text('턴인', style: TextStyle(fontSize: 10)),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: quest.progressRatio,
                    minHeight: 4,
                    backgroundColor: Colors.grey[300],
                    valueColor: AlwaysStoppedAnimation<Color>(
                      quest.status == QuestStatus.completed ? Colors.green : Colors.blue,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                quest.progressSummary,
                style: TextStyle(fontSize: 10, color: Colors.grey[600]),
              ),
            ],
          ),
          if (quest.status == QuestStatus.completed && !canTurnIn)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                '제출: ${quest.turninRoomId}',
                style: TextStyle(fontSize: 10, color: Colors.orange[700]),
              ),
            ),
        ],
      ),
    );
  }

  IconData _getCadenceIcon(QuestCadence? cadence) {
    switch (cadence) {
      case QuestCadence.daily:
        return Icons.today;
      case QuestCadence.weekly:
        return Icons.calendar_view_week;
      case QuestCadence.meta:
        return Icons.emoji_events;
      case QuestCadence.story:
        return Icons.book;
      default:
        return Icons.help_outline;
    }
  }

  Color _getCadenceColor(QuestCadence? cadence) {
    switch (cadence) {
      case QuestCadence.daily:
        return Colors.blue;
      case QuestCadence.weekly:
        return Colors.purple;
      case QuestCadence.meta:
        return Colors.amber;
      case QuestCadence.story:
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}

