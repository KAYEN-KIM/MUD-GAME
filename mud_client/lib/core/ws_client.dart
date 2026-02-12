import 'dart:convert';
import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'models.dart';

class WSClient {
  final String url;
  final String token;
  final Function(WSMessage) onMessage;
  final Function(String) onError;
  final Function() onConnected;
  final Function() onDisconnected;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _isConnected = false;

  WSClient({
    required this.url,
    required this.token,
    required this.onMessage,
    required this.onError,
    required this.onConnected,
    required this.onDisconnected,
  });

  bool get isConnected => _isConnected;

  Future<void> connect() async {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      
      _subscription = _channel!.stream.listen(
        (data) {
          try {
            // Raw message 로깅
            final rawData = data as String;
            print('[WS] Raw message 수신: $rawData');
            
            final json = jsonDecode(rawData) as Map<String, dynamic>;
            final message = WSMessage.fromJson(json);
            
            // STATE_SYNC 특별 처리 (로깅은 session_state에서)
            if (message.t == 'STATE_SYNC') {
              print('[WS] STATE_SYNC 타입 감지, payload: ${message.p}'); // ignore: avoid_print
            }
            
            onMessage(message);
          } catch (e) {
            print('[WS] 메시지 파싱 오류: $e');
            print('[WS] Raw data: ${data}');
            onError('메시지 파싱 오류: $e');
          }
        },
        onError: (error) {
          _isConnected = false;
          onError('WebSocket 오류: $error');
          onDisconnected();
        },
        onDone: () {
          _isConnected = false;
          onDisconnected();
        },
      );

      // 연결 성공으로 간주하고 AUTH 전송
      _isConnected = true;
      onConnected();
      
      // AUTH 자동 전송
      sendAuth();
    } catch (e) {
      _isConnected = false;
      onError('연결 실패: $e');
      throw Exception('WebSocket 연결 실패: $e');
    }
  }

  void sendAuth() {
    sendMessage(WSMessage(
      t: 'AUTH',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {'token': token},
    ));
  }

  void requestSpellList() {
    sendMessage(WSMessage(
      t: 'SPELL_LIST',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {},
    ));
  }

  void requestRoomMonsters() {
    sendMessage(WSMessage(
      t: 'ROOM_MONSTERS',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {},
    ));
  }

  void requestSkillList() {
    sendMessage(WSMessage(
      t: 'SKILL_LIST',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {},
    ));
  }

  void learnSkill({required String skillId}) {
    sendMessage(WSMessage(
      t: 'SKILL_LEARN',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {'skillId': skillId},
    ));
  }

  void requestDungeonList() {
    sendMessage(WSMessage(
      t: 'DUNGEON_LIST',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {},
    ));
  }

  void enterDungeon({required String dungeonId, required String difficulty}) {
    sendMessage(WSMessage(
      t: 'DUNGEON_ENTER',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {
        'dungeonId': dungeonId,
        'difficulty': difficulty,
      },
    ));
  }

  void sendMessage(WSMessage message) {
    if (!_isConnected || _channel == null) {
      onError('WebSocket이 연결되지 않았습니다.');
      return;
    }

    try {
      final jsonStr = jsonEncode(message.toJson());
      // SEND 로그 추가 (MOVE만 특별 처리)
      if (message.t == 'MOVE') {
        print('[WS] SEND MOVE: $jsonStr'); // ignore: avoid_print
      }
      _channel!.sink.add(jsonStr);
    } catch (e) {
      onError('메시지 전송 오류: $e');
    }
  }

  void disconnect() {
    _subscription?.cancel();
    _channel?.sink.close();
    _isConnected = false;
  }

  String _generateReqId() {
    return 'req_${DateTime.now().millisecondsSinceEpoch}';
  }

  // 편의 메서드들
  void partyCreate() {
    sendMessage(WSMessage(
      t: 'PARTY_CREATE',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {},
    ));
  }

  void moveDir(String dir) {
    // 방향 정규화: trim().toUpperCase()
    final normalizedDir = dir.trim().toUpperCase();
    if (!['N', 'S', 'E', 'W', 'U', 'D'].contains(normalizedDir)) {
      onError('잘못된 방향입니다. N, S, E, W, U, D만 허용됩니다.');
      return;
    }
    sendMessage(WSMessage(
      t: 'MOVE',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {'dir': normalizedDir},
    ));
  }

  void moveByRoomId(String roomId) {
    sendMessage(WSMessage(
      t: 'MOVE',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {'toRoomId': roomId}, // 서버는 toRoomId를 우선 확인하고 roomId는 하위호환
    ));
  }

  void hunt({int times = 1}) {
    sendMessage(WSMessage(
      t: 'HUNT',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {'times': times},
    ));
  }

  void combatTurn({
    required String encounterId,
    required String action,
    String? targetId,
  }) {
    sendMessage(WSMessage(
      t: 'COMBAT_TURN',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {
        'encounterId': encounterId,
        'action': action,
        if (targetId != null) 'targetId': targetId,
      },
    ));
  }

  void chatSend({required String text, String channel = 'GLOBAL'}) {
    sendMessage(WSMessage(
      t: 'CHAT_SEND',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {
        'channel': channel,
        'text': text,
      },
    ));
  }

  void cast({required String spell, String? target, String? encounterId}) {
    sendMessage(WSMessage(
      t: 'CAST',
      reqId: _generateReqId(),
      ts: DateTime.now().millisecondsSinceEpoch,
      p: {
        'spell': spell,
        if (target != null) 'target': target,
        if (encounterId != null) 'encounterId': encounterId,
      },
    ));
  }
}

