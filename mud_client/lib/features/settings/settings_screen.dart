import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/endpoints.dart';
import '../../state/session_state.dart';
import '../../core/network_detector.dart';

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
  bool _isLoading = false;

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
    
    // 캐시 초기화 (새로운 설정 적용)
    Endpoints.clearCache();
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('설정이 저장되었습니다.')),
      );
      Navigator.pop(context);
    }
  }

  Future<void> _autoDetectServer() async {
    setState(() {
      _isLoading = true;
    });

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서버 IP 자동 감지 중...')),
      );

      final serverIp = await NetworkDetector.detectServerIp(port: 3000);
      
      if (serverIp != null) {
        setState(() {
          _restController.text = 'http://$serverIp:3000';
          _wsController.text = 'ws://$serverIp:3000';
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('서버 발견: $serverIp:3000')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('서버를 찾을 수 없습니다. 수동으로 IP를 입력하세요.\n예: http://192.168.219.112:3000'),
              duration: Duration(seconds: 5),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('오류: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
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
                  'Android 에뮬레이터: 10.0.2.2:3000\n'
                  'Android/iOS 실기기: PC IP 자동 감지 (또는 수동 입력)\n'
                  'Desktop/iOS 시뮬레이터/웹: http://localhost:3000\n\n'
                  '⚠️ 자동 감지가 실패하면 PC IP를 수동으로 입력하세요.\n'
                  '⚠️ PC와 기기가 같은 Wi-Fi에 연결되어 있어야 합니다.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _restController,
                        decoration: InputDecoration(
                          labelText: 'REST Base URL',
                          hintText: Endpoints.getDefaultRestUrl(),
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      onPressed: _isLoading ? null : _autoDetectServer,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.search, size: 18),
                      label: const Text('자동 감지'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ],
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

