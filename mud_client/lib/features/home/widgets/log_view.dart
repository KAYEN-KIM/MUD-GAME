import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../state/session_state.dart';

class LogView extends StatelessWidget {
  const LogView({super.key});

  Color _getColorForType(String type) {
    switch (type) {
      case 'ERROR':
        return Colors.red;
      case 'AUTH':
        return Colors.green;
      case 'COMBAT':
        return Colors.orange;
      case 'ACTION':
        return Colors.blue;
      case 'STATE':
        return Colors.purple;
      default:
        return Colors.black87;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        final logs = session.logs;

        if (logs.isEmpty) {
          return const Center(
            child: Text('로그가 없습니다. Connect를 눌러 연결하세요.'),
          );
        }

        return ListView.builder(
          reverse: true,
          itemCount: logs.length,
          itemBuilder: (context, index) {
            final log = logs[logs.length - 1 - index];
            final timeStr = '${log.timestamp.hour.toString().padLeft(2, '0')}:'
                '${log.timestamp.minute.toString().padLeft(2, '0')}:'
                '${log.timestamp.second.toString().padLeft(2, '0')}';

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 9,
                      color: Colors.grey,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      log.content,
                      style: TextStyle(
                        fontSize: 11,
                        color: _getColorForType(log.type),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

