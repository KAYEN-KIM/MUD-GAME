import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/models.dart';
import '../core/models/season_status.dart';
import '../core/models/quest_models.dart';
import '../core/models/party_models.dart';
import '../core/storage.dart';
import '../core/ws_client.dart';
import '../core/api_client.dart';
import '../core/request_tracker.dart';

enum ConnectionStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

class SessionState extends ChangeNotifier {
  // URLs
  String? _restUrl;
  String? _wsUrl;
  
  // Auth
  String? _token;
  
  // Developer Mode
  bool _developerMode = false;
  
  // WebSocket
  WSClient? _wsClient;
  ConnectionStatus _connectionStatus = ConnectionStatus.disconnected;
  
  // Game State
  final GameState gameState = GameState();
  
  // Logs
  final List<LogEntry> _logs = [];
  static const int _maxLogs = 500; // 로그 최대 보관량
  
  // Move Lock (쿨다운)
  bool _isMoveLocked = false;
  DateTime? _lastMoveAt;
  static const Duration _moveTimeout = Duration(milliseconds: 1500);
  Timer? _moveUnlockTimer;
  
  // Reconnection
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 20;
  static const Duration _initialReconnectDelay = Duration(milliseconds: 500);
  static const Duration _maxReconnectDelay = Duration(seconds: 10);
  
  // Shop (room 기반 자동 탐지)
  ShopView? _activeShop;
  String? _lastShopRoomId;
  bool _shopLoading = false;
  
  // Season & Quest
  SeasonStatus? _seasonStatus;
  List<QuestTemplateView> _availableQuests = [];
  List<QuestActiveView> _activeQuests = [];
  
  // Party
  PartyInfo? _partyInfo;
  
  // RequestTracker (reqId 매칭)
  final RequestTracker _requestTracker = RequestTracker();
  
  // Getters
  String? get restUrl => _restUrl;
  String? get wsUrl => _wsUrl;
  String? get token => _token;
  ConnectionStatus get connectionStatus => _connectionStatus;
  bool get isConnected => _connectionStatus == ConnectionStatus.connected;
  bool get developerMode => _developerMode;
  List<LogEntry> get logs => List.unmodifiable(_logs);
  bool get isMoveLocked => _isMoveLocked;
  int get reconnectAttempts => _reconnectAttempts;
  
  // Shop getters
  ShopView? get activeShop => _activeShop;
  bool get isShopAvailable => _activeShop != null;
  bool get shopLoading => _shopLoading;
  
  // Season & Quest getters
  SeasonStatus? get seasonStatus => _seasonStatus;
  List<QuestTemplateView> get availableQuests => List.unmodifiable(_availableQuests);
  List<QuestActiveView> get activeQuests => List.unmodifiable(_activeQuests);
  
  // Quest 완료 카운트 (배지용)
  int get completedQuestsCount => _activeQuests.where((q) => q.status == QuestStatus.completed).length;
  
  // 턴인 가능한 퀘스트 (현재 방에서 턴인 가능한 COMPLETED 퀘스트)
  List<QuestActiveView> get turninableQuests {
    final currentRoom = gameState.roomId;
    if (currentRoom == null) return [];
    return _activeQuests
        .where((q) => q.status == QuestStatus.completed && q.turninRoomId == currentRoom)
        .toList();
  }
  
  // Party getters
  PartyInfo? get partyInfo => _partyInfo;
  bool get isInParty => _partyInfo != null;
  bool get isPartyLeader {
    if (_partyInfo == null) return false;
    final myCharId = gameState.characterId;
    if (myCharId == null) return false;
    return _partyInfo!.isLeader(myCharId);
  }
  
  String get connectionStatusText {
    switch (_connectionStatus) {
      case ConnectionStatus.connecting:
        return '연결 중...';
      case ConnectionStatus.connected:
        return '연결됨';
      case ConnectionStatus.disconnected:
        return '연결 끊김';
      case ConnectionStatus.reconnecting:
        return '재연결 중... ($_reconnectAttempts/$_maxReconnectAttempts)';
    }
  }
  
  // 초기화
  Future<void> init() async {
    _restUrl = await Storage.getRestUrl();
    _wsUrl = await Storage.getWsUrl();
    _token = await Storage.getToken();
    _developerMode = await Storage.getDeveloperMode();
    notifyListeners();
  }
  
  // URLs 설정
  Future<void> setUrls(String restUrl, String wsUrl) async {
    _restUrl = restUrl;
    _wsUrl = wsUrl;
    await Storage.saveRestUrl(restUrl);
    await Storage.saveWsUrl(wsUrl);
    notifyListeners();
  }
  
  // Developer Mode 설정
  void setDeveloperMode(bool enabled) {
    _developerMode = enabled;
    Storage.saveDeveloperMode(enabled);
    notifyListeners();
  }
  
  // 로그인/회원가입
  Future<void> login(String email, String password) async {
    if (_restUrl == null) throw Exception('REST URL이 설정되지 않았습니다.');
    
    final client = ApiClient(_restUrl!);
    final result = await client.login(email: email, password: password);
    
    _token = result['token'] as String;
    await Storage.saveToken(_token!);
    
    if (result['character'] != null) {
      final char = result['character'] as Map<String, dynamic>;
      gameState.characterName = char['name'] as String?;
      gameState.characterId = char['id'] as String?;
    }
    
    notifyListeners();
  }
  
  Future<void> register(String email, String password, String characterName) async {
    if (_restUrl == null) throw Exception('REST URL이 설정되지 않았습니다.');
    
    final client = ApiClient(_restUrl!);
    final result = await client.register(
      email: email,
      password: password,
      characterName: characterName,
    );
    
    _token = result['token'] as String;
    await Storage.saveToken(_token!);
    
    if (result['character'] != null) {
      final char = result['character'] as Map<String, dynamic>;
      gameState.characterName = char['name'] as String?;
      gameState.characterId = char['id'] as String?;
    }
    
    notifyListeners();
  }
  
  Future<void> logout() async {
    disconnect();
    await Storage.deleteToken();
    _token = null;
    _logs.clear();
    notifyListeners();
  }
  
  // WebSocket 연결
  Future<void> connect() async {
    if (_wsUrl == null || _token == null) {
      addLog('WebSocket URL 또는 토큰이 없습니다.', 'ERROR');
      return;
    }
    
    _connectionStatus = ConnectionStatus.connecting;
    notifyListeners();
    
    _wsClient = WSClient(
      url: _wsUrl!,
      token: _token!,
      onMessage: _handleMessage,
      onError: (error) {
        addLog('WebSocket 오류: $error', 'ERROR');
        notifyListeners();
      },
      onConnected: () {
        _connectionStatus = ConnectionStatus.connected;
        _reconnectAttempts = 0; // 성공 시 재시도 카운터 리셋
        addLog('✅ WebSocket 연결됨', 'SYSTEM');
        notifyListeners();
      },
      onDisconnected: () {
        if (_connectionStatus == ConnectionStatus.connected) {
          addLog('🔌 WebSocket 연결 끊김', 'SYSTEM');
          _connectionStatus = ConnectionStatus.disconnected;
          notifyListeners();
          // 자동 재연결 시작
          _scheduleReconnect();
        }
      },
    );
    
    try {
      await _wsClient!.connect();
    } catch (e) {
      addLog('❌ 연결 실패: $e', 'ERROR');
      _connectionStatus = ConnectionStatus.disconnected;
      notifyListeners();
      // 재연결 스케줄
      _scheduleReconnect();
    }
  }
  
  void disconnect() {
    _cancelReconnect();
    _wsClient?.disconnect();
    _wsClient = null;
    _connectionStatus = ConnectionStatus.disconnected;
    notifyListeners();
  }
  
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      addLog('❌ 재연결 실패: 최대 재시도 횟수 도달', 'ERROR');
      _connectionStatus = ConnectionStatus.disconnected;
      notifyListeners();
      return;
    }
    
    // 지수 백오프 계산 (0.5s, 1s, 2s, 4s, 8s, 최대 10s)
    final delay = _calculateReconnectDelay();
    _reconnectAttempts++;
    _connectionStatus = ConnectionStatus.reconnecting;
    notifyListeners();
    
    addLog('🔄 재연결 예정... (시도 $_reconnectAttempts/$_maxReconnectAttempts, ${delay.inMilliseconds}ms 후)', 'SYSTEM');
    
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }
  
  Duration _calculateReconnectDelay() {
    // 지수 백오프 + 지터
    final baseDelay = _initialReconnectDelay.inMilliseconds * (1 << (_reconnectAttempts - 1).clamp(0, 5));
    final jitter = (baseDelay * 0.1 * (0.5 + (DateTime.now().millisecond % 100) / 100.0)).toInt();
    final totalDelay = (baseDelay + jitter).clamp(
      _initialReconnectDelay.inMilliseconds,
      _maxReconnectDelay.inMilliseconds,
    );
    return Duration(milliseconds: totalDelay);
  }
  
  void _cancelReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;
  }
  
  void manualReconnect() {
    _reconnectAttempts = 0;
    disconnect();
    connect();
  }
  
  // 메시지 핸들러
  void _handleMessage(WSMessage message) {
    switch (message.t) {
      case 'AUTH_OK':
        addLog('✅ 인증 성공', 'AUTH');
        // Party 정보 요청
        Future.delayed(const Duration(milliseconds: 500), () => requestPartyInfo());
        break;
      case 'AUTH_FAIL':
        final reason = message.p['reason'] as String? ?? '알 수 없음';
        addLog('❌ 인증 실패: $reason', 'AUTH');
        break;
      case 'LOG_APPEND':
        final scope = message.p['scope'] as String? ?? 'SYSTEM';
        final text = message.p['text'] as String? ?? '';
        addLog('[$scope] $text', 'LOG');
        break;
      case 'STATE_SYNC':
        // WS 수신 로깅: raw message 출력
        try {
          print('[WS] STATE_SYNC 수신: ${message.p}'); // ignore: avoid_print
          
          // exits 정보 로깅
          final exitsData = message.p['exits'];
          if (exitsData != null) {
            final exitsList = exitsData as List?;
            print('[WS] STATE_SYNC.exits 길이: ${exitsList?.length ?? 0}'); // ignore: avoid_print
            if (exitsList != null && exitsList.isNotEmpty) {
              final firstExit = exitsList[0] as Map<String, dynamic>?;
              if (firstExit != null) {
                print('[WS] STATE_SYNC.exits[0]: label=${firstExit['label']}, toRoomId=${firstExit['toRoomId']}, dir=${firstExit['dir']}'); // ignore: avoid_print
              }
            }
          } else {
            print('[WS] STATE_SYNC.exits 없음 - availableExits 확인: ${message.p['availableExits']}'); // ignore: avoid_print
            print('[WS] STATE_SYNC.room 확인: ${message.p['room']}'); // ignore: avoid_print
          }
        } catch (e) {
          print('[WS] STATE_SYNC 로깅 오류: $e'); // ignore: avoid_print
          print('[WS] Raw message.p: ${message.p}'); // ignore: avoid_print
        }
        
        // roomId 변경 감지 (상점 자동 탐지용)
        final oldRoomId = gameState.roomId;
        
        gameState.updateFromStateSync(message.p);
        addLog('상태 동기화: ${gameState.getSummary()}', 'STATE');
        
        // STATE_SYNC 수신 시 이동 잠금 즉시 해제
        _unlockMove();
        
        // roomId가 변경되었고, 아직 해당 방의 상점을 조회하지 않았으면 SHOP_LIST 요청
        final newRoomId = gameState.roomId;
        if (newRoomId != null && newRoomId != _lastShopRoomId) {
          _requestShopList(newRoomId);
        }
        break;
      case 'ERROR':
        final errorMsg = message.p['message'] as String? ?? '알 수 없는 오류';
        addLog('❌ $errorMsg', 'ERROR');
        break;
      case 'INVENTORY_LIST':
        if (message.p['inventory'] != null) {
          final inventoryList = message.p['inventory'] as List;
          gameState.inventory = inventoryList
              .map((item) => InventoryItem.fromJson(item as Map<String, dynamic>))
              .toList();
          addLog('📦 인벤토리 목록 수신: ${gameState.inventory?.length ?? 0}개', 'SYSTEM');
          notifyListeners();
        }
        break;
      case 'SHOP_LIST':
        try {
          _activeShop = ShopView.fromJson(message.p);
          _shopLoading = false;
          _lastShopRoomId = gameState.roomId;
          addLog('🏪 상점 발견: ${_activeShop!.title} (${_activeShop!.items.length}개)', 'SYSTEM');
        } catch (e) {
          print('[WS] SHOP_LIST 파싱 실패: $e'); // ignore: avoid_print
          _activeShop = null;
          _shopLoading = false;
        }
        break;
      case 'SHOP_BUY_FAILED':
      case 'SHOP_LIST_FAILED':
        // 상점 에러 (상점이 없는 방)
        _activeShop = null;
        _shopLoading = false;
        _lastShopRoomId = gameState.roomId;
        break;
      case 'SHOP_BUY_OK':
        try {
          // reqId로 pending 요청 완료
          if (message.reqId != null) {
            final result = ShopBuyResult.fromJson(message.p);
            _requestTracker.complete(message.reqId!, result);
            
            // 즉시 UI 반영: balances와 granted
            if (result.balances.containsKey('gold')) {
              gameState.gold = result.balances['gold'];
            }
            
            // 인벤토리 아이템 추가 (granted)
            if (result.qty > 0) {
              _addInventoryItem(result.itemId, result.qty);
            }
            
            // cost에서 차감된 아이템 반영 (인장/트로피 등)
            if (result.cost != null) {
              for (final entry in result.cost!.entries) {
                if (entry.key != 'gold') {
                  _subtractInventoryItem(entry.key, entry.value);
                }
              }
            }
            
            addLog('✅ 구매 성공: ${result.itemId} x${result.qty}', 'SYSTEM');
          }
        } catch (e) {
          print('[WS] SHOP_BUY_OK 파싱 실패: $e'); // ignore: avoid_print
          if (message.reqId != null) {
            _requestTracker.completeError(message.reqId!, Exception('응답 파싱 실패: $e'));
          }
        }
        break;
      case 'SHOP_BUY_ERR':
        try {
          if (message.reqId != null) {
            final code = message.p['code'] as String? ?? 'UNKNOWN';
            final errMsg = message.p['message'] as String? ?? '구매 실패';
            final itemId = message.p['itemId'] as String?;
            
            final error = ShopBuyError(
              code: code,
              message: errMsg,
              itemId: itemId,
            );
            
            _requestTracker.completeError(message.reqId!, error);
            addLog('❌ 구매 실패: ${error.toUserMessage()}', 'ERROR');
          }
        } catch (e) {
          print('[WS] SHOP_BUY_ERR 파싱 실패: $e'); // ignore: avoid_print
          if (message.reqId != null) {
            _requestTracker.completeError(message.reqId!, Exception('에러 응답 파싱 실패'));
          }
        }
        break;
      case 'SEASON_STATUS':
        try {
          _seasonStatus = SeasonStatus.fromJson(message.p);
          addLog('📅 시즌 상태 수신: Season ${_seasonStatus!.currentSeason}, ${_seasonStatus!.dayIndexInSeason}/${_seasonStatus!.seasonLengthDays}일차', 'SYSTEM');
        } catch (e) {
          print('[WS] SEASON_STATUS 파싱 실패: $e'); // ignore: avoid_print
        }
        break;
      case 'QUEST_LIST':
        try {
          final availableJson = message.p['available'] as List?;
          final activeJson = message.p['active'] as List?;
          
          _availableQuests = availableJson != null
              ? availableJson.map((q) => QuestTemplateView.fromJson(q as Map<String, dynamic>)).toList()
              : [];
          _activeQuests = activeJson != null
              ? activeJson.map((q) => QuestActiveView.fromJson(q as Map<String, dynamic>)).toList()
              : [];
          
          addLog('📜 퀘스트 목록 수신: 수락 가능 ${_availableQuests.length}개, 진행 중 ${_activeQuests.length}개', 'SYSTEM');
        } catch (e) {
          print('[WS] QUEST_LIST 파싱 실패: $e'); // ignore: avoid_print
        }
        break;
      case 'QUEST_TRACK':
        try {
          final activeJson = message.p['active'] as List?;
          final completedIds = (message.p['completedIds'] as List?)?.cast<String>() ?? [];
          
          if (activeJson != null) {
            // activeQuests를 questId 맵으로 변환하여 병합
            final updatedQuests = activeJson.map((q) => QuestActiveView.fromJson(q as Map<String, dynamic>)).toList();
            final questMap = {for (var q in _activeQuests) q.questId: q};
            
            for (var updated in updatedQuests) {
              questMap[updated.questId] = updated;
            }
            
            // 정렬: COMPLETED 우선, 그 다음 cadence 순 (DAILY → WEEKLY → META → STORY)
            _activeQuests = questMap.values.toList()
              ..sort((a, b) {
                // COMPLETED 우선
                if (a.status == QuestStatus.completed && b.status != QuestStatus.completed) return -1;
                if (a.status != QuestStatus.completed && b.status == QuestStatus.completed) return 1;
                
                // cadence 순서
                final cadenceOrder = {
                  QuestCadence.daily: 0,
                  QuestCadence.weekly: 1,
                  QuestCadence.meta: 2,
                  QuestCadence.story: 3,
                };
                final orderA = cadenceOrder[a.cadence] ?? 999;
                final orderB = cadenceOrder[b.cadence] ?? 999;
                return orderA.compareTo(orderB);
              });
            
            // completedIds가 있으면 로그에 표시
            if (completedIds.isNotEmpty) {
              addLog('🎉 퀘스트 완료: ${completedIds.join(", ")}', 'SYSTEM');
            }
          }
        } catch (e) {
          print('[WS] QUEST_TRACK 파싱 실패: $e'); // ignore: avoid_print
        }
        break;
      case 'PARTY_SYNC':
        try {
          if (message.p == null) {
            // 파티 없음
            _partyInfo = null;
            addLog('파티를 나갔습니다.', 'SYSTEM');
          } else {
            _partyInfo = PartyInfo.fromJson(message.p as Map<String, dynamic>);
            addLog('🎉 파티 정보 업데이트: ${_partyInfo!.memberCount}명', 'SYSTEM');
          }
        } catch (e) {
          print('[WS] PARTY_SYNC 파싱 실패: $e'); // ignore: avoid_print
        }
        break;
      case 'ENCOUNTER_START':
        final encId = message.p['encounterId'] as String? ?? '';
        gameState.encounterId = encId;
        final encIdDisplay = encId.isNotEmpty && encId.length >= 8 
            ? encId.substring(0, 8) 
            : encId;
        addLog('⚔️ 전투 시작! (ID: $encIdDisplay...)', 'COMBAT');
        break;
      case 'COMBAT_RESOLVE':
        final turnNo = message.p['turnNo'];
        addLog('📊 턴 $turnNo 해결됨', 'COMBAT');
        final actions = message.p['actions'] as List?;
        if (actions != null) {
          for (final action in actions) {
            addLog('  $action', 'COMBAT');
          }
        }
        break;
      case 'COMBAT_END':
        final result = message.p['result'] as String? ?? 'UNKNOWN';
        final rewards = message.p['rewards'] as Map<String, dynamic>?;
        gameState.encounterId = null;
        addLog('🏁 전투 종료: $result', 'COMBAT');
        if (rewards != null) {
          final exp = rewards['expGained'] ?? 0;
          final gold = rewards['goldGained'] ?? 0;
          final items = rewards['items'] as List? ?? [];
          addLog('💰 보상: EXP +$exp, GOLD +$gold, 아이템 ${items.length}개', 'COMBAT');
        }
        break;
      default:
        addLog('${message.t}: ${message.p}', 'OTHER');
    }
    
    notifyListeners();
  }
  
  void addLog(String content, String type) {
    _logs.add(LogEntry(
      timestamp: DateTime.now(),
      type: type,
      content: content,
    ));
    
    // 로그 최대 보관량 제한
    if (_logs.length > _maxLogs) {
      _logs.removeRange(0, _logs.length - _maxLogs);
    }
    
    notifyListeners();
  }
  
  // 이동 잠금/해제 관리
  void _lockMove() {
    _isMoveLocked = true;
    _lastMoveAt = DateTime.now();
    notifyListeners();
    
    // 타임아웃 failsafe: 1.5초 후 자동 해제
    _moveUnlockTimer?.cancel();
    _moveUnlockTimer = Timer(_moveTimeout, () {
      if (_isMoveLocked) {
        _unlockMove();
      }
    });
  }

  void _unlockMove() {
    if (_isMoveLocked) {
      _isMoveLocked = false;
      _moveUnlockTimer?.cancel();
      _moveUnlockTimer = null;
      notifyListeners();
    }
  }

  bool _checkMoveLock() {
    if (!_isMoveLocked) {
      return false;
    }
    
    // 타임아웃 체크 (failsafe)
    if (_lastMoveAt != null) {
      final elapsed = DateTime.now().difference(_lastMoveAt!);
      if (elapsed >= _moveTimeout) {
        _unlockMove();
        return false;
      }
    }
    
    return true;
  }
  
  bool canSendMove() {
    return !_checkMoveLock();
  }
  
  // 액션 메서드들
  void partyCreate() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    _wsClient!.partyCreate();
    addLog('👥 파티 생성 요청', 'ACTION');
  }
  
  void moveDir(String dir) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    _wsClient!.moveDir(dir);
    addLog('🚶 이동 요청 (dir): $dir', 'ACTION');
  }

  void moveByRoomId(String roomId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    
    // 이동 쿨다운 체크
    if (_checkMoveLock()) {
      addLog('⏳ 이동 쿨다운 중...', 'SYSTEM');
      return;
    }
    
    _lockMove();
    _wsClient!.moveByRoomId(roomId);
    addLog('🚶 이동 요청 (toRoomId): $roomId', 'ACTION');
  }

  // 방향키 입력 시 exits를 이용해 toRoomId 찾아서 이동
  void moveDirByExits(String dir) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }

    // 이동 쿨다운 체크
    if (_checkMoveLock()) {
      addLog('⏳ 이동 쿨다운 중...', 'SYSTEM');
      return;
    }

    final normalizedDir = dir.trim().toUpperCase();
    final exits = gameState.exits;

    if (exits == null || exits.isEmpty) {
      addLog('❌ 출구 정보가 없습니다. STATE_SYNC를 기다려주세요.', 'ERROR');
      return;
    }

    // 1) exits에서 e.dir이 일치하는 exit 찾기
    RoomExit? targetExit;
    try {
      targetExit = exits.firstWhere(
        (e) => e.dir != null && e.dir!.trim().toUpperCase() == normalizedDir,
      );
    } catch (e) {
      targetExit = null;
    }

    // 2) 없으면 fallback index map 사용
    if (targetExit == null) {
      final dirIndexMap = {'N': 0, 'E': 1, 'S': 2, 'W': 3, 'U': 4, 'D': 5};
      final index = dirIndexMap[normalizedDir];
      if (index != null && index < exits.length) {
        targetExit = exits[index];
      }
    }

    // 3) target exit이 있으면 toRoomId로 이동
    if (targetExit != null) {
      _lockMove();
      _wsClient!.moveByRoomId(targetExit.toRoomId);
      addLog('🚶 방향 이동 ($normalizedDir → ${targetExit.label})', 'ACTION');
    } else {
      addLog('❌ 해당 방향 단축 출구 없음: $normalizedDir', 'ERROR');
    }
  }
  
  // 방향키에 매핑된 출구 찾기 (UI 표시용)
  RoomExit? getExitForDir(String dir) {
    final normalizedDir = dir.trim().toUpperCase();
    final exits = gameState.exits;
    
    if (exits == null || exits.isEmpty) {
      return null;
    }
    
    // 1) dir이 일치하는 exit 찾기
    try {
      return exits.firstWhere(
        (e) => e.dir != null && e.dir!.trim().toUpperCase() == normalizedDir,
      );
    } catch (e) {
      // 2) 없으면 fallback index map 사용
      final dirIndexMap = {'N': 0, 'E': 1, 'S': 2, 'W': 3, 'U': 4, 'D': 5};
      final index = dirIndexMap[normalizedDir];
      if (index != null && index < exits.length) {
        return exits[index];
      }
      return null;
    }
  }
  
  void hunt() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    _wsClient!.hunt();
    addLog('🎯 사냥 시작', 'ACTION');
  }
  
  void combatTurn(String action) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    
    if (gameState.encounterId == null) {
      addLog('전투 중이 아닙니다.', 'ERROR');
      return;
    }
    
    _wsClient!.combatTurn(
      encounterId: gameState.encounterId!,
      action: action,
    );
    addLog('⚔️ 전투 행동: $action', 'ACTION');
  }
  
  void chatSend(String text) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    _wsClient!.chatSend(text: text);
    addLog('💬 채팅 전송: $text', 'ACTION');
  }

  // Shop 메서드들
  void _requestShopList(String roomId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    
    _activeShop = null;
    _shopLoading = true;
    _lastShopRoomId = roomId;
    notifyListeners();
    
    send('SHOP_LIST', {});
  }

  void send(String type, Map<String, dynamic> payload) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    _wsClient!.sendMessage(WSMessage(
      t: type,
      ts: DateTime.now().millisecondsSinceEpoch,
      p: payload,
    ));
  }

  /// reqId를 생성하여 전송하는 send 메서드
  String sendWithReqId(String type, Map<String, dynamic> payload) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      throw Exception('WebSocket이 연결되지 않았습니다.');
    }
    
    final reqId = 'req_${DateTime.now().millisecondsSinceEpoch}_${payload.hashCode.abs()}';
    _wsClient!.sendMessage(WSMessage(
      t: type,
      reqId: reqId,
      ts: DateTime.now().millisecondsSinceEpoch,
      p: payload,
    ));
    return reqId;
  }

  /// 인벤토리 아이템 추가 (로컬 상태)
  void _addInventoryItem(String itemId, int qty) {
    if (gameState.inventory == null) {
      gameState.inventory = [];
    }
    
    final existingIndex = gameState.inventory!.indexWhere((item) => item.itemId == itemId);
    
    if (existingIndex >= 0) {
      // 기존 아이템 수량 증가
      final existingItem = gameState.inventory![existingIndex];
      gameState.inventory![existingIndex] = InventoryItem(
        itemId: existingItem.itemId,
        name: existingItem.name,
        type: existingItem.type,
        slot: existingItem.slot,
        qty: existingItem.qty + qty,
        atk: existingItem.atk,
        def: existingItem.def,
        hpBonus: existingItem.hpBonus,
        priceSell: existingItem.priceSell,
      );
    } else {
      // 새 아이템 - 기본값으로 생성 (서버에서 STATE_SYNC로 정확한 정보가 올 예정)
      gameState.inventory!.add(InventoryItem(
        itemId: itemId,
        name: itemId, // 기본값: itemId를 name으로 사용 (서버에서 업데이트될 예정)
        type: 'ITEM',
        qty: qty,
        atk: 0,
        def: 0,
        hpBonus: 0,
        priceSell: 0,
      ));
    }
    
    notifyListeners();
  }

  /// 인벤토리 아이템 차감 (로컬 상태)
  void _subtractInventoryItem(String itemId, int qty) {
    if (gameState.inventory == null) return;
    
    final index = gameState.inventory!.indexWhere((item) => item.itemId == itemId);
    if (index >= 0) {
      final currentItem = gameState.inventory![index];
      final newQty = currentItem.qty - qty;
      
      if (newQty <= 0) {
        // 수량이 0 이하면 제거
        gameState.inventory!.removeAt(index);
      } else {
        // 수량 차감
        gameState.inventory![index] = InventoryItem(
          itemId: currentItem.itemId,
          name: currentItem.name,
          type: currentItem.type,
          slot: currentItem.slot,
          qty: newQty,
          atk: currentItem.atk,
          def: currentItem.def,
          hpBonus: currentItem.hpBonus,
          priceSell: currentItem.priceSell,
        );
      }
      
      notifyListeners();
    }
  }

  /// 상점 구매 (reqId 기반 응답 대기)
  Future<ShopBuyResult> shopBuy(String itemId) async {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      throw Exception('WebSocket이 연결되지 않았습니다.');
    }
    
    final reqId = sendWithReqId('SHOP_BUY', {'itemId': itemId});
    addLog('🛒 구매 요청: $itemId (reqId: ${reqId.substring(0, 16)}...)', 'ACTION');
    
    try {
      final result = await _requestTracker.waitFor<ShopBuyResult>(reqId);
      return result;
    } catch (e) {
      // 타임아웃 또는 에러
      if (e is ShopBuyError) {
        rethrow;
      } else if (e is TimeoutException) {
        throw Exception('구매 요청 시간 초과 (10초)');
      } else {
        throw Exception('구매 요청 실패: $e');
      }
    }
  }

  // Season & Quest 메서드들
  void requestSeasonStatus() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    send('SEASON_STATUS', {});
  }

  void requestQuestList() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('QUEST_LIST', {});
    addLog('📜 퀘스트 목록 요청', 'ACTION');
  }

  void questAccept(String questId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('QUEST_ACCEPT', {'questId': questId});
    addLog('✅ 퀘스트 수락 요청: $questId', 'ACTION');
  }

  void questTurnIn(String questId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('QUEST_TURNIN', {'questId': questId});
    addLog('📤 퀘스트 제출 요청: $questId', 'ACTION');
  }

  void partyJoin(String code) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('PARTY_JOIN', {'code': code});
    addLog('🎉 파티 가입 요청: $code', 'ACTION');
  }

  void partyLeave() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('PARTY_LEAVE', {});
    addLog('👋 파티 나가기 요청', 'ACTION');
  }

  // Party 메서드들
  void requestPartyInfo() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    send('PARTY_INFO', {});
  }
}
