import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';
import '../../../core/models/quest_models.dart';

class QuestCard extends StatelessWidget {
  final QuestTemplateView? availableQuest;
  final QuestActiveView? activeQuest;
  final VoidCallback? onAccept;
  final VoidCallback? onTurnIn;

  const QuestCard({
    super.key,
    this.availableQuest,
    this.activeQuest,
    this.onAccept,
    this.onTurnIn,
  }) : assert(availableQuest != null || activeQuest != null);

  @override
  Widget build(BuildContext context) {
    final session = context.read<SessionState>();
    final currentRoomId = session.gameState.roomId;

    if (availableQuest != null) {
      return _buildAvailableQuest(context, availableQuest!, currentRoomId);
    } else if (activeQuest != null) {
      return _buildActiveQuest(context, activeQuest!, currentRoomId);
    }
    return const SizedBox.shrink();
  }

  Widget _buildAvailableQuest(BuildContext context, QuestTemplateView quest, String? currentRoomId) {
    final canAccept = currentRoomId != null && currentRoomId == quest.giverRoomId;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Icon(
          _getCadenceIcon(quest.cadence),
          size: 32,
          color: _getCadenceColor(quest.cadence),
        ),
        title: Text(
          quest.title,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(quest.description, style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 4),
            Text(
              '수락: ${quest.giverRoomId} | 제출: ${quest.turninRoomId}',
              style: TextStyle(fontSize: 10, color: Colors.grey[600]),
            ),
          ],
        ),
        trailing: ElevatedButton(
          onPressed: canAccept ? onAccept : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.green[700],
            foregroundColor: Colors.white,
          ),
          child: const Text('수락'),
        ),
      ),
    );
  }

  Widget _buildActiveQuest(BuildContext context, QuestActiveView quest, String? currentRoomId) {
    final canTurnIn = quest.status == QuestStatus.completed && 
                      currentRoomId != null && 
                      currentRoomId == quest.turninRoomId;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Icon(
          _getCadenceIcon(quest.cadence),
          size: 32,
          color: _getCadenceColor(quest.cadence),
        ),
        title: Text(
          quest.title,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              '진행도: ${quest.progressSummary}',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            ClipRRect(
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
            const SizedBox(height: 4),
            Text(
              quest.status == QuestStatus.completed
                  ? '제출 위치: ${quest.turninRoomId}${canTurnIn ? " (제출 가능)" : " (현재 위치: $currentRoomId)"}'
                  : '제출 위치: ${quest.turninRoomId}',
              style: TextStyle(fontSize: 10, color: Colors.grey[600]),
            ),
          ],
        ),
        trailing: quest.status == QuestStatus.completed
            ? ElevatedButton(
                onPressed: canTurnIn && onTurnIn != null ? onTurnIn : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: canTurnIn ? Colors.orange[700] : Colors.grey[400],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                child: const Text('턴인'),
              )
            : null, // 진행 중 퀘스트는 로딩 표시 제거
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

