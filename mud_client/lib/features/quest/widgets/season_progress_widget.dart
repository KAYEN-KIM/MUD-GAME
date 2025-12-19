import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';

class SeasonProgressWidget extends StatelessWidget {
  const SeasonProgressWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        final seasonStatus = session.seasonStatus;
        if (seasonStatus == null) {
          return const SizedBox.shrink();
        }

        // 스탬프 수량 조회
        final stampQty = session.gameState.getItemQty('ITEM_LEDGER_STAMP_S1');
        
        // 메타 마일스톤 (9, 18, 30, 42)
        final milestones = [9, 18, 30, 42];
        final nextMilestone = milestones.firstWhere(
          (m) => stampQty < m,
          orElse: () => 42,
        );
        final remainingStamps = (nextMilestone - stampQty).clamp(0, 42);

        return Card(
          margin: const EdgeInsets.all(8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.emoji_events, size: 20, color: Colors.amber),
                    const SizedBox(width: 8),
                    Text(
                      'Season ${seasonStatus.currentSeason} — ${seasonStatus.dayIndexInSeason}/${seasonStatus.seasonLengthDays}일차',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    if (seasonStatus.dayIndexInSeason >= 15) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.purple[100],
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '보너스',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.purple[800],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('스탬프: ', style: TextStyle(fontSize: 14)),
                    Text(
                      '$stampQty/42',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.amber),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (stampQty / 42).clamp(0.0, 1.0),
                    minHeight: 8,
                    backgroundColor: Colors.grey[300],
                    valueColor: const AlwaysStoppedAnimation<Color>(Colors.amber),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '다음 마일스톤($nextMilestone)까지: $remainingStamps개 남음',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
                // Season Lock: Coming Soon 안내
                if ((seasonStatus.maxUnlockedSeason ?? 99) <= 1) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Season 2: Coming Soon',
                    style: TextStyle(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

