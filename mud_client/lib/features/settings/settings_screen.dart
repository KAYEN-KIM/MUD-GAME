import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/endpoints.dart';
import '../../state/session_state.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _restController;
  late TextEditingController _wsController;
  String? _initialRestUrl;
  String? _initialWsUrl;
  bool _developerMode = false;

  @override
  void initState() {
    super.initState();
    // 기본값 설정 (나중에 Consumer에서 업데이트)
    _initialRestUrl = Endpoints.getDefaultRestUrl();
    _initialWsUrl = Endpoints.getDefaultWsUrl();
    _restController = TextEditingController(text: _initialRestUrl);
    _wsController = TextEditingController(text: _initialWsUrl);
  }
  
  @override
  void dispose() {
    _restController.dispose();
    _wsController.dispose();
    super.dispose();
  }

  Future<void> _saveSettings() async {
    final session = context.read<SessionState>();
    await session.setUrls(_restController.text, _wsController.text);
    session.setDeveloperMode(_developerMode);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('설정이 저장되었습니다.')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionState>(
      builder: (context, session, _) {
        // 저장된 값이 있으면 사용, 없으면 기본값
        if (_restController.text.isEmpty || _restController.text == _initialRestUrl) {
          final savedRest = session.restUrl ?? Endpoints.getDefaultRestUrl();
          if (_restController.text != savedRest) {
            _restController.text = savedRest;
          }
        }
        if (_wsController.text.isEmpty || _wsController.text == _initialWsUrl) {
          final savedWs = session.wsUrl ?? Endpoints.getDefaultWsUrl();
          if (_wsController.text != savedWs) {
            _wsController.text = savedWs;
          }
        }
        
        // 개발자 모드 로드
        if (_developerMode != session.developerMode) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            setState(() {
              _developerMode = session.developerMode;
            });
          });
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('서버 설정'),
          ),
          body: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  '서버 엔드포인트',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Android 에뮬레이터는 10.0.2.2 사용\n'
                  'Desktop/실기기: localhost:3000 또는 서버 IP',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _restController,
                  decoration: InputDecoration(
                    labelText: 'REST Base URL',
                    hintText: Endpoints.getDefaultRestUrl(),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _wsController,
                  decoration: InputDecoration(
                    labelText: 'WS URL',
                    hintText: Endpoints.getDefaultWsUrl(),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 24),
                SwitchListTile(
                  title: const Text('개발자 모드'),
                  subtitle: const Text('룸 ID 직접 이동 기능 활성화'),
                  value: _developerMode,
                  onChanged: (value) {
                    setState(() {
                      _developerMode = value;
                    });
                  },
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _saveSettings,
                  child: const Text('저장'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

