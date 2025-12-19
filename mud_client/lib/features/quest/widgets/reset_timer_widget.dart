import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';
import '../../../core/models/season_status.dart';
import 'dart:async';

class ResetTimerWidget extends StatefulWidget {
  const ResetTimerWidget({super.key});

  @override
  State<ResetTimerWidget> createState() => _ResetTimerWidgetState();
}

class _ResetTimerWidgetState extends State<ResetTimerWidget> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  String _formatDuration(int ms) {
    if (ms < 0) return '00:00:00';
    
    final seconds = ms ~/ 1000;
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  String _formatDurationWithDays(int ms) {
    if (ms < 0) return '0일 00:00:00';
    
    final seconds = ms ~/ 1000;
    final days = seconds ~/ 86400;
    final hours = (seconds % 86400) ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    
    return '${days}일 ${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        final seasonStatus = session.seasonStatus;
        if (seasonStatus == null) {
          return const SizedBox.shrink();
        }

        final dailyRemaining = seasonStatus.dailyResetRemainingMs;
        final weeklyRemaining = seasonStatus.weeklyResetRemainingMs;
        final seasonRemaining = seasonStatus.seasonEndRemainingMs;

        // 타이머가 0 이하가 되면 서버에 재요청
        if (dailyRemaining <= 0 || weeklyRemaining <= 0 || seasonRemaining <= 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            session.requestSeasonStatus();
          });
        }

        return Card(
          margin: const EdgeInsets.all(8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '⏰ 리셋 타이머',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.today, size: 16, color: Colors.blue),
                    const SizedBox(width: 8),
                    const Text('일일 리셋: ', style: TextStyle(fontSize: 12)),
                    Text(
                      _formatDuration(dailyRemaining),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.calendar_view_week, size: 16, color: Colors.purple),
                    const SizedBox(width: 8),
                    const Text('주간 리셋: ', style: TextStyle(fontSize: 12)),
                    Text(
                      _formatDurationWithDays(weeklyRemaining),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.purple),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.event, size: 16, color: Colors.orange),
                    const SizedBox(width: 8),
                    const Text('시즌 종료: ', style: TextStyle(fontSize: 12)),
                    Text(
                      _formatDurationWithDays(seasonRemaining),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

