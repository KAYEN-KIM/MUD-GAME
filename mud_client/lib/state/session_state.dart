import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/models.dart';
import '../core/models_extended.dart';
import '../core/models/season_status.dart';
import '../core/models/quest_models.dart';
import '../core/models/party_models.dart';
import '../core/storage.dart';
import '../core/ws_client.dart';
import '../core/api_client.dart';
import '../core/request_tracker.dart';
import '../core/endpoints.dart';

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
  
  // Room Monsters (현재 방의 몬스터 목록)
  List<Map<String, dynamic>> _roomMonsters = [];
  
  // Spells (주문 목록)
  List<Map<String, dynamic>> _availableSpells = [];

  // Skills
  List<SkillView> _availableSkills = [];

  // Dungeons
  List<DungeonView> _availableDungeons = [];

  // Guilds (서버 미구현: UI 컴파일/표시용 스텁)
  List<GuildView> _availableGuilds = [];

  // Achievements (서버 미구현: UI 컴파일/표시용 스텁)
  List<AchievementView> _availableAchievements = [];

  // Crafting recipes (서버 미구현: UI 컴파일/표시용 스텁)
  List<Map<String, dynamic>> _availableRecipes = [];
  
  // Trade inbox (받은 거래 제안)
  List<Map<String, dynamic>> _tradeInbox = [];
  
  // Marketplace listings
  List<Map<String, dynamic>> _marketplaceListings = [];
  
  // Resource nodes
  List<Map<String, dynamic>> _resourceNodes = [];
  
  // Story (스토리 챕터 목록)
  List<Map<String, dynamic>> _storyChapters = [];
  
  // NPC (NPC 목록)
  List<Map<String, dynamic>> _npcs = [];
  // Room floor items (간단 구현)
  List<Map<String, dynamic>> _roomItems = [];

  // NPC talk context (choose 지원)
  String? _lastNpcTalkNpcId;
  String? _lastNpcTalkDialogueId;
  int _lastNpcTalkChoicesCount = 0;
  
  // Combat State (tick-based combat)
  bool _isInCombat = false;
  DateTime? _lastCombatTickAt;
  
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
  
  // Room Monsters getters
  List<Map<String, dynamic>> get roomMonsters => List.unmodifiable(_roomMonsters);
  
  // Spells getters
  List<Map<String, dynamic>> get availableSpells => List.unmodifiable(_availableSpells);

  // Skills getters
  List<SkillView> get availableSkills => List.unmodifiable(_availableSkills);

  // Dungeons getters
  List<DungeonView> get availableDungeons => List.unmodifiable(_availableDungeons);

  // Guild getters
  List<GuildView> get availableGuilds => List.unmodifiable(_availableGuilds);

  // Achievement getters
  List<AchievementView> get availableAchievements => List.unmodifiable(_availableAchievements);

  // Crafting getters
  List<Map<String, dynamic>> get availableRecipes => List.unmodifiable(_availableRecipes);
  
  // Trade getters
  List<Map<String, dynamic>> get tradeInbox => List.unmodifiable(_tradeInbox);
  
  // Marketplace getters
  List<Map<String, dynamic>> get marketplaceListings => List.unmodifiable(_marketplaceListings);
  
  // Resource nodes getters
  List<Map<String, dynamic>> get resourceNodes => List.unmodifiable(_resourceNodes);
  
  // Story getters
  List<Map<String, dynamic>> get storyChapters => List.unmodifiable(_storyChapters);
  
  // NPC getters
  List<Map<String, dynamic>> get npcs => List.unmodifiable(_npcs);
  List<Map<String, dynamic>> get roomItems => List.unmodifiable(_roomItems);
  
  // Combat State getters
  bool get isInCombat => _isInCombat;
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
    
    // URL이 없으면 자동 감지 시도 (Android 실제 기기용)
    if (_restUrl == null || _wsUrl == null) {
      try {
        final detectedRestUrl = await Endpoints.getAutoDetectedRestUrl();
        final detectedWsUrl = await Endpoints.getAutoDetectedWsUrl();
        
        if (detectedRestUrl != null && detectedWsUrl != null) {
          _restUrl = detectedRestUrl;
          _wsUrl = detectedWsUrl;
          // 감지된 URL 저장
          await Storage.saveRestUrl(_restUrl!);
          await Storage.saveWsUrl(_wsUrl!);
        } else {
          // 자동 감지 실패 시 기본값 사용
          _restUrl = Endpoints.getDefaultRestUrl();
          _wsUrl = Endpoints.getDefaultWsUrl();
        }
      } catch (e) {
        // 자동 감지 실패 시 기본값 사용
        _restUrl = Endpoints.getDefaultRestUrl();
        _wsUrl = Endpoints.getDefaultWsUrl();
      }
    }
    
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
    if (_restUrl == null) {
      print('[SessionState] REST URL이 설정되지 않았습니다.');
      throw Exception('REST URL이 설정되지 않았습니다. 설정 화면에서 서버 주소를 입력하세요.');
    }
    
    print('[SessionState] Register 시작');
    print('[SessionState] REST URL: $_restUrl');
    
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
        // NOTE: 서버가 AUTH 성공 시 자동으로 LOOK를 1회 전송하므로 중복 요청하지 않는다.
        break;
      case 'AUTH_FAIL':
        final reason = message.p['reason'] as String? ?? '알 수 없음';
        addLog('❌ 인증 실패: $reason', 'AUTH');
        break;
      case 'LOG_APPEND':
        final scope = message.p['scope'] as String? ?? 'SYSTEM';
        final text = message.p['text'] as String? ?? '';
        addLog('[$scope] $text', 'LOG');
        
        // 전투 시작/종료 메시지 감지
        if (scope == 'COMBAT') {
          if (text.contains('You engage') && text.contains('in combat!')) {
            // Tick-based combat: ATTACK 명령
            _isInCombat = true;
            _lastCombatTickAt = DateTime.now();
            notifyListeners();
          } else if (text.contains('조우했습니다') || text.contains('과(와) 조우했습니다')) {
            // Turn-based combat: HUNT 명령
            _isInCombat = true;
            _lastCombatTickAt = DateTime.now();
            print('[SessionState] LOG_APPEND: 조우 감지, _isInCombat=$_isInCombat'); // ignore: avoid_print
            notifyListeners();
          } else if (text.contains('Victory!') || text.contains('Defeat!') || text.contains('전투 종료') || text.contains('전투에서 승리했습니다')) {
            // 전투 종료 메시지
            _isInCombat = false;
            _lastCombatTickAt = null;
            print('[SessionState] LOG_APPEND: 전투 종료 감지, _isInCombat=$_isInCombat'); // ignore: avoid_print
            notifyListeners();
          }
        }
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
        // 상태 동기화 로그는 표시하지 않음 (사용자 요청)
        // addLog('상태 동기화: ${gameState.getSummary()}', 'STATE');
        
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
        final errorCode = message.p['code'] as String?;
        
        // 상점 관련 에러는 조용히 처리 (로그만, 사용자에게 알림 안 함)
        if (errorCode == 'INVALID_STATE' && errorMsg.contains('상점')) {
          // 상점이 없는 방으로 이동한 경우 - 정상 동작이므로 조용히 처리
          print('[WS] 상점 없음 (정상): $errorMsg'); // ignore: avoid_print
          // 상점 로딩 상태 해제
          _activeShop = null;
          _shopLoading = false;
          _lastShopRoomId = gameState.roomId;
          notifyListeners(); // UI 업데이트
        } else {
          // 다른 에러는 로그에 표시
          addLog('❌ $errorMsg', 'ERROR');
        }
        break;
      case 'INVENTORY_LIST':
        if (message.p['inventory'] != null) {
          final inventoryList = message.p['inventory'] as List;
          gameState.inventory = inventoryList
              .map((item) => InventoryItem.fromJson(item as Map<String, dynamic>))
              .toList();
          final inv = gameState.inventory ?? [];
          if (inv.isEmpty) {
            addLog('📦 인벤토리: 비어있음', 'SYSTEM');
          } else {
            final lines = <String>['📦 인벤토리 (${inv.length})'];
            for (final item in inv) {
              final stat = [
                if (item.atk != 0) 'ATK+${item.atk}',
                if (item.def != 0) 'DEF+${item.def}',
                if (item.hpBonus != 0) 'HP+${item.hpBonus}',
              ].join(' ');
              final suffix = [
                if (item.qty > 1) 'x${item.qty}',
                if (stat.isNotEmpty) stat,
              ].join(' ');
              lines.add('- ${item.name}${suffix.isNotEmpty ? ' ($suffix)' : ''}');
            }
            addLog(lines.join('\n'), 'SYSTEM');
          }
          notifyListeners();
        }
        break;
      case 'ROOM_MONSTERS':
        try {
          final monstersJson = message.p['monsters'] as List?;
          _roomMonsters = monstersJson != null
              ? monstersJson.map((m) => m as Map<String, dynamic>).toList()
              : [];
          if (_roomMonsters.isEmpty) {
            addLog('👹 몬스터: 없음', 'SYSTEM');
          } else {
            final lines = <String>['👹 몬스터 (${_roomMonsters.length})'];
            for (final m in _roomMonsters) {
              final id = m['id']?.toString() ?? '';
              final name = m['name']?.toString() ?? id;
              final level = m['level']?.toString();
              lines.add('- ${name}${level != null ? ' (Lv.$level)' : ''} [${id}]');
            }
            addLog(lines.join('\n'), 'SYSTEM');
          }
          notifyListeners();
        } catch (e) {
          print('[WS] ROOM_MONSTERS 파싱 실패: $e'); // ignore: avoid_print
          _roomMonsters = [];
          addLog('👹 몬스터 목록 파싱 실패', 'ERROR');
          notifyListeners();
        }
        break;
      case 'EQUIPMENT_GET':
        try {
          final equipment = message.p['equipment'] as Map<String, dynamic>? ?? {};
          if (equipment.isEmpty) {
            addLog('🛡️ 장비: 없음', 'SYSTEM');
          } else {
            final slots = equipment.keys.toList()..sort();
            final lines = <String>['🛡️ 장비'];
            for (final slot in slots) {
              final v = equipment[slot];
              if (v == null) {
                lines.add('- $slot: (비어있음)');
              } else if (v is Map) {
                final name = v['name']?.toString() ?? v['itemId']?.toString() ?? '(알 수 없음)';
                lines.add('- $slot: $name');
              } else {
                lines.add('- $slot: $v');
              }
            }
            addLog(lines.join('\n'), 'SYSTEM');
          }
          notifyListeners();
        } catch (e) {
          addLog('🛡️ 장비 정보 파싱 실패: $e', 'ERROR');
          notifyListeners();
        }
        break;
      case 'SPELL_LIST':
        try {
          final spellsJson = message.p['spells'] as List?;
          _availableSpells = spellsJson != null
              ? spellsJson.map((s) => s as Map<String, dynamic>).toList()
              : [];
          notifyListeners();
        } catch (e) {
          print('[WS] SPELL_LIST 파싱 실패: $e'); // ignore: avoid_print
          _availableSpells = [];
          notifyListeners();
        }
        break;
      case 'SKILL_LIST':
        try {
          final skillsJson = message.p['skills'] as List?;
          _availableSkills = skillsJson != null
              ? skillsJson
                  .map((s) => SkillView.fromJson(s as Map<String, dynamic>))
                  .toList()
              : [];
          notifyListeners();
        } catch (e) {
          print('[WS] SKILL_LIST 파싱 실패: $e'); // ignore: avoid_print
          _availableSkills = [];
          notifyListeners();
        }
        break;
      case 'DUNGEON_LIST':
        try {
          final dungeonsJson = message.p['dungeons'] as List?;
          _availableDungeons = dungeonsJson != null
              ? dungeonsJson
                  .map((d) => DungeonView.fromJson(d as Map<String, dynamic>))
                  .toList()
              : [];
          notifyListeners();
        } catch (e) {
          print('[WS] DUNGEON_LIST 파싱 실패: $e'); // ignore: avoid_print
          _availableDungeons = [];
          notifyListeners();
        }
        break;
      case 'STORY_LIST':
        try {
          final chaptersJson = message.p['chapters'] as List?;
          _storyChapters = chaptersJson != null
              ? chaptersJson.map((c) => c as Map<String, dynamic>).toList()
              : [];
          notifyListeners();
        } catch (e) {
          print('[WS] STORY_LIST 파싱 실패: $e'); // ignore: avoid_print
          _storyChapters = [];
          notifyListeners();
        }
        break;
      case 'NPC_LIST':
        try {
          final npcsJson = message.p['npcs'] as List?;
          _npcs = npcsJson != null
              ? npcsJson.map((n) => n as Map<String, dynamic>).toList()
              : [];
          if (_npcs.isEmpty) {
            addLog('👥 NPC: 없음', 'SYSTEM');
          } else {
            final lines = <String>['👥 NPC (${_npcs.length})'];
            for (final n in _npcs) {
              final id = n['id']?.toString() ?? '';
              final name = n['name']?.toString() ?? id;
              lines.add('- $name [$id]');
            }
            addLog(lines.join('\n'), 'SYSTEM');
          }
          notifyListeners();
        } catch (e) {
          print('[WS] NPC_LIST 파싱 실패: $e'); // ignore: avoid_print
          _npcs = [];
          addLog('👥 NPC 목록 파싱 실패', 'ERROR');
          notifyListeners();
        }
        break;
      case 'NPC_TALK':
        try {
          final dialogue = message.p['dialogue'] as Map<String, dynamic>?;
          final npcName = message.p['npcName'] as String?;
          _lastNpcTalkNpcId = message.p['npcId'] as String?;
          _lastNpcTalkDialogueId = dialogue?['id'] as String?;
          final choices = dialogue?['choices'] as List?;
          _lastNpcTalkChoicesCount = choices?.length ?? 0;
          if (dialogue != null && npcName != null) {
            final text = dialogue['text'] as List?;
            if (text != null) {
              for (final line in text) {
                addLog('$npcName: $line', 'SYSTEM');
              }
            }
            if (choices != null && choices.isNotEmpty) {
              addLog('선택지:', 'SYSTEM');
              for (int i = 0; i < choices.length; i++) {
                final c = choices[i] as Map<String, dynamic>?;
                addLog('  ${i + 1}) ${c?['text'] ?? ''}', 'SYSTEM');
              }
              addLog('→ choose <번호> 로 진행', 'SYSTEM');
            }
          }
          notifyListeners();
        } catch (e) {
          print('[WS] NPC_TALK 파싱 실패: $e'); // ignore: avoid_print
        }
        break;
      case 'ROOM_ITEMS_LIST':
        try {
          final items = message.p['items'] as List?;
          _roomItems = items != null ? items.map((e) => e as Map<String, dynamic>).toList() : [];
          if (_roomItems.isEmpty) {
            addLog('🧺 바닥 아이템: 없음', 'SYSTEM');
          } else {
            final lines = <String>['🧺 바닥 아이템 (${_roomItems.length})'];
            for (final it in _roomItems) {
              final name = it['name']?.toString() ?? it['itemId']?.toString() ?? '';
              final id = it['itemId']?.toString() ?? '';
              final qty = it['qty']?.toString() ?? '0';
              lines.add('- $name x$qty [$id]');
            }
            addLog(lines.join('\n'), 'SYSTEM');
          }
          notifyListeners();
        } catch (e) {
          addLog('🧺 바닥 아이템 파싱 실패: $e', 'ERROR');
          _roomItems = [];
          notifyListeners();
        }
        break;
      case 'GUILD_LIST_OK':
        try {
          final guilds = message.p['guilds'] as List?;
          _availableGuilds = guilds != null
              ? guilds.map((g) => GuildView.fromJson(g as Map<String, dynamic>)).toList()
              : [];
          notifyListeners();
        } catch (e) {
          addLog('🏰 길드 목록 파싱 실패: $e', 'ERROR');
          _availableGuilds = [];
          notifyListeners();
        }
        break;
      case 'GUILD_VAULT_LIST_OK':
        try {
          final vaultGold = message.p['vaultGold'] ?? 0;
          final items = message.p['items'] as List?;
          addLog('💰 길드 금고: ${vaultGold}G, 아이템 ${items?.length ?? 0}개', 'SYSTEM');
          // TODO: UI에 표시할 상태 저장 필요 시 추가
        } catch (e) {
          addLog('💰 길드 금고 조회 파싱 실패: $e', 'ERROR');
        }
        break;
      case 'GUILD_VAULT_DEPOSIT_GOLD_OK':
      case 'GUILD_VAULT_WITHDRAW_GOLD_OK':
      case 'GUILD_VAULT_DEPOSIT_ITEM_OK':
      case 'GUILD_VAULT_WITHDRAW_ITEM_OK':
        addLog('✅ 길드 금고 작업 완료', 'SYSTEM');
        break;
      case 'GUILD_WAR_CHALLENGE_OK':
        addLog('✅ 길드 전쟁 선포 완료', 'SYSTEM');
        break;
      case 'GUILD_WAR_ACCEPT_OK':
        addLog('✅ 길드 전쟁 수락 완료', 'SYSTEM');
        break;
      case 'GUILD_WAR_LIST_OK':
        try {
          final wars = message.p['wars'] as List?;
          if (wars != null && wars.isNotEmpty) {
            final lines = <String>['⚔️ 길드 전쟁 목록 (${wars.length})'];
            for (final w in wars) {
              final challenger = w['challengerGuildName']?.toString() ?? '???';
              final defender = w['defenderGuildName']?.toString() ?? '???';
              final status = w['status']?.toString() ?? 'UNKNOWN';
              final challengerScore = w['challengerScore'] ?? 0;
              final defenderScore = w['defenderScore'] ?? 0;
              lines.add('- $challenger vs $defender ($status) [$challengerScore:$defenderScore]');
            }
            addLog(lines.join('\n'), 'SYSTEM');
          } else {
            addLog('⚔️ 진행 중인 길드 전쟁이 없습니다', 'SYSTEM');
          }
        } catch (e) {
          addLog('⚔️ 길드 전쟁 목록 파싱 실패: $e', 'ERROR');
        }
        break;
      case 'GUILD_WAR_MATCH_OK':
        addLog('✅ 길드 전쟁 매치 생성 완료', 'SYSTEM');
        break;
      case 'GUILD_QUEST_LIST_OK':
        try {
          final active = message.p['active'] as List?;
          final completed = message.p['completed'] as List?;
          final lines = <String>['📜 길드 퀘스트'];
          if (active != null && active.isNotEmpty) {
            lines.add('진행 중 (${active.length}):');
            for (final q in active) {
              final questId = q['questId']?.toString() ?? '???';
              final progress = q['progress'] ?? 0;
              final target = q['target'] ?? 1;
              lines.add('- $questId: $progress/$target');
            }
          }
          if (completed != null && completed.isNotEmpty) {
            lines.add('완료 (${completed.length}):');
            for (final q in completed) {
              final questId = q['questId']?.toString() ?? '???';
              lines.add('- $questId');
            }
          }
          if ((active == null || active.isEmpty) && (completed == null || completed.isEmpty)) {
            lines.add('진행 중인 퀘스트가 없습니다');
          }
          addLog(lines.join('\n'), 'SYSTEM');
        } catch (e) {
          addLog('📜 길드 퀘스트 목록 파싱 실패: $e', 'ERROR');
        }
        break;
      case 'GUILD_QUEST_ACCEPT_OK':
        addLog('✅ 길드 퀘스트 수락 완료', 'SYSTEM');
        break;
      case 'GUILD_QUEST_TURNIN_OK':
        try {
          final guildExpReward = message.p['guildExpReward'] ?? 0;
          addLog('✅ 길드 퀘스트 완료! 길드 경험치 +$guildExpReward', 'SYSTEM');
        } catch (e) {
          addLog('✅ 길드 퀘스트 완료', 'SYSTEM');
        }
        break;
      case 'CRAFT_LIST_OK':
        try {
          final recipes = message.p['recipes'] as List?;
          _availableRecipes = recipes != null
              ? recipes.map((r) => r as Map<String, dynamic>).toList()
              : [];
          notifyListeners();
        } catch (e) {
          addLog('🛠️ 레시피 파싱 실패: $e', 'ERROR');
          _availableRecipes = [];
          notifyListeners();
        }
        break;
      case 'ACHIEVEMENT_LIST_OK':
        try {
          final list = message.p['achievements'] as List?;
          _availableAchievements = list != null
              ? list.map((a) => AchievementView.fromJson(a as Map<String, dynamic>)).toList()
              : [];
          notifyListeners();
        } catch (e) {
          addLog('🏅 업적 목록 파싱 실패: $e', 'ERROR');
          _availableAchievements = [];
          notifyListeners();
        }
        break;
      case 'ACHIEVEMENT_CLAIM_OK':
        addLog('🏅 업적 보상을 수령했습니다.', 'SYSTEM');
        // 서버에서 STATE_SYNC / INVENTORY_LIST가 뒤따를 수 있으니 여기서는 목록만 갱신
        send('ACHIEVEMENT_LIST', {});
        break;
      case 'TRADE_OFFER_INBOX':
        try {
          final offerId = message.p['offerId']?.toString() ?? '';
          final fromName = message.p['fromName']?.toString() ?? '???';
          final gold = message.p['offeredGold']?.toString() ?? '0';
          addLog('🤝 거래 제안 도착: $fromName (gold=$gold) offerId=$offerId', 'SYSTEM');
          if (offerId.isNotEmpty) {
            // 중복 방지: 동일 offerId가 있으면 갱신
            _tradeInbox.removeWhere((o) => (o['offerId']?.toString() ?? '') == offerId);
            _tradeInbox.insert(0, {
              'offerId': offerId,
              'fromCharacterId': message.p['fromCharacterId'],
              'fromName': fromName,
              'offeredGold': message.p['offeredGold'] ?? 0,
              'offeredItems': message.p['offeredItems'] ?? const [],
              'ts': message.ts,
            });
            notifyListeners();
          }
        } catch (_) {}
        break;
      case 'TRADE_OFFER_ACCEPT_OK':
        try {
          final offerId = message.p['offerId']?.toString() ?? '';
          if (offerId.isNotEmpty) {
            _tradeInbox.removeWhere((o) => (o['offerId']?.toString() ?? '') == offerId);
            notifyListeners();
          }
          addLog('✅ 거래를 수락했습니다. (offerId=$offerId)', 'SYSTEM');
        } catch (_) {}
        break;
      case 'TRADE_OFFER_REJECT_OK':
        try {
          final offerId = message.p['offerId']?.toString() ?? '';
          if (offerId.isNotEmpty) {
            _tradeInbox.removeWhere((o) => (o['offerId']?.toString() ?? '') == offerId);
            notifyListeners();
          }
          addLog('❌ 거래를 거절했습니다. (offerId=$offerId)', 'SYSTEM');
        } catch (_) {}
        break;
      case 'TRADE_OFFER_ACCEPTED':
        try {
          final offerId = message.p['offerId']?.toString() ?? '';
          final toName = message.p['toName']?.toString() ?? '';
          addLog('✅ 거래가 수락되었습니다: $toName (offerId=$offerId)', 'SYSTEM');
        } catch (_) {}
        break;
      case 'TRADE_OFFER_REJECTED':
        try {
          final offerId = message.p['offerId']?.toString() ?? '';
          final toName = message.p['toName']?.toString() ?? '';
          addLog('❌ 거래가 거절되었습니다: $toName (offerId=$offerId)', 'SYSTEM');
        } catch (_) {}
        break;
      case 'MARKETPLACE_LIST_OK':
        try {
          final listings = message.p['listings'] as List?;
          _marketplaceListings = listings != null
              ? listings.map((l) => l as Map<String, dynamic>).toList()
              : [];
          notifyListeners();
          addLog('🏪 경매장 목록: ${_marketplaceListings.length}개', 'SYSTEM');
        } catch (e) {
          addLog('🏪 경매장 목록 파싱 실패: $e', 'ERROR');
          _marketplaceListings = [];
          notifyListeners();
        }
        break;
      case 'MARKETPLACE_LISTING_CREATE_OK':
        addLog('🏪 경매장 등록 완료', 'SYSTEM');
        break;
      case 'MARKETPLACE_BID_OK':
        addLog('💰 입찰 완료', 'SYSTEM');
        break;
      case 'MARKETPLACE_BUY_NOW_OK':
        addLog('✅ 즉시구매 완료', 'SYSTEM');
        break;
      case 'MARKETPLACE_CANCEL_OK':
        addLog('❌ 경매 취소 완료', 'SYSTEM');
        break;
      case 'NODE_LIST_OK':
        try {
          final nodes = message.p['nodes'] as List?;
          _resourceNodes = nodes != null
              ? nodes.map((n) => n as Map<String, dynamic>).toList()
              : [];
          notifyListeners();
          addLog('⛏️ 자원 노드: ${_resourceNodes.length}개', 'SYSTEM');
        } catch (e) {
          addLog('⛏️ 자원 노드 목록 파싱 실패: $e', 'ERROR');
          _resourceNodes = [];
          notifyListeners();
        }
        break;
      case 'GATHER_OK':
        try {
          final gathered = message.p['gathered'] ?? false;
          final itemId = message.p['itemId'];
          final qty = message.p['qty'] ?? 0;
          if (gathered && itemId != null) {
            addLog('⛏️ 채집 성공! $itemId x$qty', 'SYSTEM');
          }
          // 노드 목록 갱신
          send('NODE_LIST', {});
        } catch (e) {
          addLog('채집 결과 파싱 실패: $e', 'ERROR');
        }
        break;
      case 'SHOP_LIST':
        try {
          _activeShop = ShopView.fromJson(message.p);
          _shopLoading = false;
          _lastShopRoomId = gameState.roomId;
          addLog('🏪 상점 발견: ${_activeShop!.title} (${_activeShop!.items.length}개)', 'SYSTEM');
          notifyListeners(); // UI 업데이트
        } catch (e) {
          print('[WS] SHOP_LIST 파싱 실패: $e'); // ignore: avoid_print
          _activeShop = null;
          _shopLoading = false;
          notifyListeners(); // UI 업데이트
        }
        break;
      case 'SHOP_BUY_FAILED':
      case 'SHOP_LIST_FAILED':
        // 상점 에러 (상점이 없는 방) - 조용히 처리 (로그만)
        _activeShop = null;
        _shopLoading = false;
        _lastShopRoomId = gameState.roomId;
        notifyListeners(); // UI 업데이트
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
            
            // cost는 서버에서 이미 처리되었으므로 클라이언트에서는 골드만 반영
            // costItems는 서버에서 이미 차감되었음
            
            addLog('✅ 구매 성공: ${result.itemId} x${result.qty}', 'SYSTEM');
          }
        } catch (e) {
          print('[WS] SHOP_BUY_OK 파싱 실패: $e'); // ignore: avoid_print
          if (message.reqId != null) {
            _requestTracker.completeError(message.reqId!, Exception('응답 파싱 실패: $e'));
          }
        }
        break;
      case 'ENHANCE_OK':
        try {
          final slot = message.p['slot']?.toString() ?? '';
          final newLevel = message.p['newLevel'] ?? 0;
          final success = message.p['success'] ?? false;
          final destroyed = message.p['destroyed'] ?? false;
          if (success) {
            addLog('✨ 강화 성공! $slot +$newLevel', 'SYSTEM');
          } else if (destroyed) {
            addLog('💥 강화 실패! $slot이(가) 파괴되어 +0이 되었습니다.', 'SYSTEM');
          } else {
            addLog('❌ 강화 실패! $slot', 'SYSTEM');
          }
          // 장비 목록 갱신
          send('EQUIPMENT_GET', {});
        } catch (e) {
          addLog('강화 결과 파싱 실패: $e', 'ERROR');
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
      case 'QUEST_ACCEPT_FAILED':
        final errorMsg = message.p['message'] as String? ?? '퀘스트 수락 실패';
        addLog('❌ $errorMsg', 'ERROR');
        notifyListeners(); // UI 업데이트 (로딩 상태 해제)
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
          
          // 디버깅 정보
          print('[WS] QUEST_LIST 수신: 수락 가능 ${_availableQuests.length}개, 진행 중 ${_activeQuests.length}개'); // ignore: avoid_print
          if (_availableQuests.isNotEmpty) {
            print('[WS] 수락 가능 퀘스트 giverRoomId: ${_availableQuests.map((q) => q.giverRoomId).join(", ")}'); // ignore: avoid_print
            print('[WS] 현재 방: ${gameState.roomId}'); // ignore: avoid_print
          }
          
          addLog('📜 퀘스트 목록 수신: 수락 가능 ${_availableQuests.length}개, 진행 중 ${_activeQuests.length}개', 'SYSTEM');
          notifyListeners(); // UI 업데이트 (퀘스트 수락 후 자동 갱신)
        } catch (e) {
          print('[WS] QUEST_LIST 파싱 실패: $e'); // ignore: avoid_print
          notifyListeners(); // UI 업데이트
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
      case 'ATTACK_ACK':
        // Tick-based combat: ATTACK 성공 시 전투 시작
        final inCombat = message.p['inCombat'] as bool? ?? false;
        if (inCombat) {
          _isInCombat = true;
          _lastCombatTickAt = DateTime.now();
          notifyListeners();
        }
        break;
      case 'ENCOUNTER_START':
        final encId = message.p['encounterId'] as String? ?? '';
        gameState.encounterId = encId;
        _isInCombat = true;
        _lastCombatTickAt = DateTime.now();
        final encIdDisplay = encId.isNotEmpty && encId.length >= 8 
            ? encId.substring(0, 8) 
            : encId;
        print('[SessionState] ENCOUNTER_START: encounterId=$encId, _isInCombat=$_isInCombat'); // ignore: avoid_print
        addLog('⚔️ 전투 시작! (ID: $encIdDisplay...)', 'COMBAT');
        notifyListeners();
        break;
      case 'COMBAT_TICK':
        // Tick-based combat system
        _isInCombat = true;
        _lastCombatTickAt = DateTime.now();
        final tickData = message.p;
        final lines = tickData['lines'] as List?;
        if (lines != null) {
          for (final line in lines) {
            addLog(line.toString(), 'COMBAT');
          }
        }
        // 전투 종료 확인
        final ended = tickData['ended'] as bool? ?? false;
        if (ended) {
          _isInCombat = false;
          _lastCombatTickAt = null;
        }
        notifyListeners();
        break;
      case 'COMBAT_RESOLVE':
        // 기존 turn-based combat 시스템: 전투 중으로 설정
        // encounterId가 있으면 전투 중으로 간주
        final encId = message.p['encounterId'] as String?;
        if (encId != null && encId.isNotEmpty) {
          gameState.encounterId = encId;
          _isInCombat = true;
          _lastCombatTickAt = DateTime.now();
          print('[SessionState] COMBAT_RESOLVE: encounterId=$encId, _isInCombat=$_isInCombat'); // ignore: avoid_print
          notifyListeners();
        }
        // 턴 해결 로그는 표시하지 않음 (사용자 요청)
        break;
      case 'COMBAT_END':
        final result = message.p['result'] as String? ?? 'UNKNOWN';
        final rewards = message.p['rewards'] as Map<String, dynamic>?;
        gameState.encounterId = null;
        _isInCombat = false;
        _lastCombatTickAt = null;
        print('[SessionState] COMBAT_END: _isInCombat=$_isInCombat, encounterId=null'); // ignore: avoid_print
        addLog('🏁 전투 종료: $result', 'COMBAT');
        if (rewards != null) {
          final exp = rewards['expGained'] ?? 0;
          final gold = rewards['goldGained'] ?? 0;
          final items = rewards['items'] as List? ?? [];
          addLog('💰 보상: EXP +$exp, GOLD +$gold, 아이템 ${items.length}개', 'COMBAT');
        }
        notifyListeners();
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
    // 이동 로그는 표시하지 않음 (사용자 요청)
    // addLog('🚶 이동 요청 (dir): $dir', 'ACTION');
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
    // 이동 로그는 표시하지 않음 (사용자 요청)
    // addLog('🚶 이동 요청 (toRoomId): $roomId', 'ACTION');
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
      // 이동 로그는 표시하지 않음 (사용자 요청)
      // addLog('🚶 방향 이동 ($normalizedDir → ${targetExit.label})', 'ACTION');
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

  void cast({required String spell, String? target}) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    // encounterId를 전달하여 서버에서 정확한 Encounter를 찾을 수 있도록 함
    _wsClient!.cast(spell: spell, target: target, encounterId: gameState.encounterId);
    addLog('✨ 주문 시전: $spell${target != null ? " -> $target" : ""}', 'ACTION');
  }

  void requestRoomMonsters() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    _wsClient!.requestRoomMonsters();
  }

  void requestSpellList() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    _wsClient!.requestSpellList();
  }

  void requestSkillList() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    send('SKILL_LIST', {});
    addLog('✨ 스킬 목록 요청...', 'ACTION');
  }

  void learnSkill({required String skillId}) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    send('SKILL_LEARN', {'skillId': skillId});
    addLog('✨ 스킬 학습 요청: $skillId', 'ACTION');
  }

  void useSkill({required String skillId, String? targetId}) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      return;
    }
    send('SKILL_USE', {'skillId': skillId, if (targetId != null) 'targetId': targetId});
    addLog('✨ 스킬 사용: $skillId', 'ACTION');
  }

  // Dungeon & Raid
  void requestDungeonList() {
    send('DUNGEON_LIST', {});
    addLog('🏰 던전 목록 조회...', 'ACTION');
  }

  void enterDungeon({required String dungeonId, String difficulty = 'NORMAL'}) {
    send('DUNGEON_ENTER', {'dungeonId': dungeonId, 'difficulty': difficulty});
    addLog('🏰 던전 입장 요청: $dungeonId ($difficulty)', 'ACTION');
  }

  void requestRaidList() {
    send('RAID_LIST', {});
    addLog('⚔️ 레이드 목록 조회...', 'ACTION');
  }

  void enterRaid({required String raidId}) {
    send('RAID_ENTER', {'raidId': raidId});
    addLog('⚔️ 레이드 입장 요청: $raidId', 'ACTION');
  }

  // Dungeon/Raid Status
  void requestDungeonStatus() {
    send('DUNGEON_STATUS', {});
    addLog('🏰 던전 상태 조회...', 'ACTION');
  }

  void requestRaidStatus() {
    send('RAID_STATUS', {});
    addLog('⚔️ 레이드 상태 조회...', 'ACTION');
  }

  // Pet System
  void requestPetList() {
    send('PET_LIST', {});
    addLog('🐾 펫 목록 조회...', 'ACTION');
  }

  void summonPet({required String petId}) {
    send('PET_SUMMON', {'petId': petId});
    addLog('🐾 펫 소환: $petId', 'ACTION');
  }

  void dismissPet() {
    send('PET_DISMISS', {});
    addLog('🐾 펫 해제', 'ACTION');
  }

  // Housing System
  void requestHouseInfo() {
    send('HOUSE_INFO', {});
    addLog('🏠 주택 정보 조회...', 'ACTION');
  }

  void createHouse({required String name}) {
    send('HOUSE_CREATE', {'name': name});
    addLog('🏠 주택 구매 요청: $name', 'ACTION');
  }

  void houseStorage({required String action, required String itemId, int qty = 1}) {
    send('HOUSE_STORAGE', {'action': action, 'itemId': itemId, 'qty': qty});
    addLog('📦 저장소 작업: $action $itemId x$qty', 'ACTION');
  }

  // Farm System
  void farmPlant({required int plotIndex, required String cropId}) {
    send('FARM_PLANT', {'plotIndex': plotIndex, 'cropId': cropId});
    addLog('🌱 작물 심기: 플롯 $plotIndex, $cropId', 'ACTION');
  }

  void farmHarvest({required int plotIndex}) {
    send('FARM_HARVEST', {'plotIndex': plotIndex});
    addLog('🌾 작물 수확: 플롯 $plotIndex', 'ACTION');
  }

  // Event System
  void requestEventList() {
    send('EVENT_LIST', {});
    addLog('🎉 이벤트 목록 조회...', 'ACTION');
  }

  void joinEvent({required String eventId}) {
    send('EVENT_JOIN', {'eventId': eventId});
    addLog('🎉 이벤트 참가: $eventId', 'ACTION');
  }

  void updateEventProgress({required String eventId, required Map<String, dynamic> progress}) {
    send('EVENT_PROGRESS', {'eventId': eventId, 'progress': progress});
    addLog('🎉 이벤트 진행 업데이트: $eventId', 'ACTION');
  }

  // Ranking System
  void requestRankingDungeon({String? dungeonId, String difficulty = 'NORMAL', int limit = 10}) {
    send('RANKING_DUNGEON', {
      if (dungeonId != null) 'dungeonId': dungeonId,
      'difficulty': difficulty,
      'limit': limit,
    });
    addLog('🏆 던전 랭킹 조회...', 'ACTION');
  }

  void requestRankingRaid({String? raidId, int limit = 10}) {
    send('RANKING_RAID', {
      if (raidId != null) 'raidId': raidId,
      'limit': limit,
    });
    addLog('🏆 레이드 랭킹 조회...', 'ACTION');
  }

  // --- 아래는 현재 서버 미구현 기능들: 웹/데스크탑 실행을 막지 않도록 스텁 제공 ---

  void requestGuildList() {
    _availableGuilds = [];
    send('GUILD_LIST', {});
    addLog('🏰 길드 목록 요청...', 'ACTION');
  }

  void createGuild({required String name, String description = ''}) {
    send('GUILD_CREATE', {'name': name, 'description': description});
    addLog('🏰 길드 생성 요청: $name', 'ACTION');
  }

  void joinGuild({required String guildId}) {
    send('GUILD_JOIN', {'guildId': guildId});
    addLog('🏰 길드 가입 요청: $guildId', 'ACTION');
  }

  // Guild Vault
  void requestGuildVaultList() {
    send('GUILD_VAULT_LIST', {});
    addLog('💰 길드 금고 조회...', 'ACTION');
  }

  void guildVaultDepositGold({required int amount}) {
    send('GUILD_VAULT_DEPOSIT_GOLD', {'amount': amount});
    addLog('💰 길드 금고 골드 기여: ${amount}G', 'ACTION');
  }

  void guildVaultWithdrawGold({required int amount}) {
    send('GUILD_VAULT_WITHDRAW_GOLD', {'amount': amount});
    addLog('💰 길드 금고 골드 인출: ${amount}G', 'ACTION');
  }

  void guildVaultDepositItem({required String itemId, required int qty}) {
    send('GUILD_VAULT_DEPOSIT_ITEM', {'itemId': itemId, 'qty': qty});
    addLog('📦 길드 금고 아이템 기여: $itemId x$qty', 'ACTION');
  }

  void guildVaultWithdrawItem({required String itemId, required int qty}) {
    send('GUILD_VAULT_WITHDRAW_ITEM', {'itemId': itemId, 'qty': qty});
    addLog('📦 길드 금고 아이템 인출: $itemId x$qty', 'ACTION');
  }

  // Guild War
  void guildWarChallenge({required String defenderGuildId}) {
    send('GUILD_WAR_CHALLENGE', {'defenderGuildId': defenderGuildId});
    addLog('⚔️ 길드 전쟁 선포: $defenderGuildId', 'ACTION');
  }

  void guildWarAccept({required String warId}) {
    send('GUILD_WAR_ACCEPT', {'warId': warId});
    addLog('⚔️ 길드 전쟁 수락: $warId', 'ACTION');
  }

  void requestGuildWarList() {
    send('GUILD_WAR_LIST', {});
    addLog('⚔️ 길드 전쟁 목록 조회...', 'ACTION');
  }

  void guildWarMatch({required String warId, required String targetCharacterId}) {
    send('GUILD_WAR_MATCH', {'warId': warId, 'targetCharacterId': targetCharacterId});
    addLog('⚔️ 길드 전쟁 매치 신청: $targetCharacterId', 'ACTION');
  }

  // Guild Quest
  void requestGuildQuestList() {
    send('GUILD_QUEST_LIST', {});
    addLog('📜 길드 퀘스트 목록 조회...', 'ACTION');
  }

  void guildQuestAccept({required String questId}) {
    send('GUILD_QUEST_ACCEPT', {'questId': questId});
    addLog('📜 길드 퀘스트 수락: $questId', 'ACTION');
  }

  void guildQuestTurnin({required String questId}) {
    send('GUILD_QUEST_TURNIN', {'questId': questId});
    addLog('📜 길드 퀘스트 완료: $questId', 'ACTION');
  }

  void requestAchievements() {
    _availableAchievements = [];
    send('ACHIEVEMENT_LIST', {});
    addLog('🏅 업적 목록 요청...', 'ACTION');
  }

  void claimAchievement({required String achievementId}) {
    send('ACHIEVEMENT_CLAIM', {'achievementId': achievementId});
    addLog('🏅 업적 보상 수령: $achievementId', 'ACTION');
  }

  void requestCraftingRecipes() {
    _availableRecipes = [];
    send('CRAFT_LIST', {});
    addLog('🛠️ 제작 레시피 요청...', 'ACTION');
  }

  void craftItem({required String recipeId}) {
    send('CRAFT', {'recipeId': recipeId});
    addLog('🛠️ 제작 요청: $recipeId', 'ACTION');
  }

  void enhanceItem({required String itemId, bool useProtection = false}) {
    // 레거시: slot 기반으로 변경
    addLog('⚠️ 강화는 slot 기반입니다. enhance <slot> 사용', 'SYSTEM');
  }

  void enhance({required String slot}) {
    send('ENHANCE', {'slot': slot});
    addLog('✨ 강화 요청: $slot', 'ACTION');
  }

  void sendTradeOffer({
    required String targetName,
    required List<Map<String, dynamic>> offeredItems,
    int offeredGold = 0,
  }) {
    send('TRADE_OFFER_CREATE', {
      'targetName': targetName,
      'offeredItems': offeredItems,
      'offeredGold': offeredGold,
    });
    addLog('🤝 거래 제안: $targetName (gold=$offeredGold)', 'ACTION');
  }

  void tradeAccept(String offerId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('TRADE_OFFER_ACCEPT', {'offerId': offerId});
  }

  void tradeReject(String offerId) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('TRADE_OFFER_REJECT', {'offerId': offerId});
  }

  // Marketplace
  void requestMarketplaceList({String? itemId, int page = 1, int limit = 50}) {
    send('MARKETPLACE_LIST', {'itemId': itemId, 'page': page, 'limit': limit});
    addLog('🏪 경매장 목록 요청...', 'ACTION');
  }

  void marketplaceListingCreate({
    required String itemId,
    required int qty,
    required int startingPrice,
    int? buyNowPrice,
    int durationHours = 24,
  }) {
    send('MARKETPLACE_LISTING_CREATE', {
      'itemId': itemId,
      'qty': qty,
      'startingPrice': startingPrice,
      'buyNowPrice': buyNowPrice,
      'durationHours': durationHours,
    });
    addLog('🏪 경매장 등록: $itemId x$qty (시작가: ${startingPrice}G)', 'ACTION');
  }

  void marketplaceBid({required String listingId, required int bidAmount}) {
    send('MARKETPLACE_BID', {'listingId': listingId, 'bidAmount': bidAmount});
    addLog('💰 입찰: $listingId (${bidAmount}G)', 'ACTION');
  }

  void marketplaceBuyNow({required String listingId}) {
    send('MARKETPLACE_BUY_NOW', {'listingId': listingId});
    addLog('✅ 즉시구매: $listingId', 'ACTION');
  }

  void marketplaceCancel({required String listingId}) {
    send('MARKETPLACE_CANCEL', {'listingId': listingId});
    addLog('❌ 경매 취소: $listingId', 'ACTION');
  }

  // Enhancement
  // Gathering
  void requestNodeList() {
    send('NODE_LIST', {});
    addLog('⛏️ 자원 노드 목록 요청...', 'ACTION');
  }

  void gather({required String nodeId}) {
    send('GATHER', {'nodeId': nodeId});
    addLog('⛏️ 채집 요청: $nodeId', 'ACTION');
  }

  // PVP
  void pvpChallenge({required String defenderName, int betGold = 0}) {
    send('PVP_CHALLENGE', {'defenderName': defenderName, 'betGold': betGold});
    addLog('⚔️ PVP 도전: $defenderName (배팅: ${betGold}G)', 'ACTION');
  }

  void pvpAccept({required String matchId}) {
    send('PVP_ACCEPT', {'matchId': matchId});
    addLog('⚔️ PVP 수락: $matchId', 'ACTION');
  }

  void requestPvpRanking({int limit = 50}) {
    send('PVP_RANKING', {'limit': limit});
    addLog('⚔️ PVP 랭킹 조회...', 'ACTION');
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

  // Story 메서드들
  void requestStoryList() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('STORY_LIST', {});
    addLog('📖 스토리 목록 요청', 'ACTION');
  }

  void completeStoryChapter(String chapterId, {String? choice}) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('STORY_COMPLETE', {
      'chapterId': chapterId,
      if (choice != null) 'choice': choice,
    });
    addLog('✅ 스토리 완료 요청: $chapterId', 'ACTION');
  }

  void requestNPCList() {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('NPC_LIST', {});
    addLog('👥 NPC 목록 요청', 'ACTION');
  }

  void talkToNPC(String npcId, {String? dialogueId, int? choiceIndex}) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    send('NPC_TALK', {
      'npcId': npcId,
      if (dialogueId != null) 'dialogueId': dialogueId,
      if (choiceIndex != null) 'choiceIndex': choiceIndex,
    });
    addLog('💬 NPC 대화 요청: $npcId', 'ACTION');
  }

  void chooseNpc(int choiceNumberOneBased) {
    if (_connectionStatus != ConnectionStatus.connected || _wsClient == null) {
      addLog('WebSocket이 연결되지 않았습니다.', 'ERROR');
      return;
    }
    if (_lastNpcTalkNpcId == null || _lastNpcTalkDialogueId == null) {
      addLog('진행 중인 NPC 대화가 없습니다. talk <npc> 먼저 입력하세요.', 'SYSTEM');
      return;
    }
    final idx = choiceNumberOneBased - 1;
    if (idx < 0 || idx >= _lastNpcTalkChoicesCount) {
      addLog('선택지 번호가 올바르지 않습니다. (1~$_lastNpcTalkChoicesCount)', 'SYSTEM');
      return;
    }
    send('NPC_TALK', {
      'npcId': _lastNpcTalkNpcId,
      'dialogueId': _lastNpcTalkDialogueId,
      'choiceIndex': idx,
    });
    addLog('👉 선택: $choiceNumberOneBased', 'ACTION');
  }

  // ===== SOCIAL SYSTEM METHODS =====

  void requestFriendList() {
    send('FRIEND_LIST', {});
    addLog('👥 친구 목록 조회...', 'ACTION');
  }

  void friendAdd(String friendName) {
    send('FRIEND_ADD', {'friendName': friendName});
    addLog('👥 친구 추가 요청: $friendName', 'ACTION');
  }

  void friendAccept(String friendRequestId) {
    send('FRIEND_ACCEPT', {'friendRequestId': friendRequestId});
    addLog('👥 친구 요청 수락: $friendRequestId', 'ACTION');
  }

  void friendRemove(String friendId) {
    send('FRIEND_REMOVE', {'friendId': friendId});
    addLog('👥 친구 삭제: $friendId', 'ACTION');
  }

  void requestBlacklistList() {
    send('BLACKLIST_LIST', {});
    addLog('🚫 차단 목록 조회...', 'ACTION');
  }

  void blacklistAdd(String blockedName, {String? reason}) {
    send('BLACKLIST_ADD', {'blockedName': blockedName, if (reason != null) 'reason': reason});
    addLog('🚫 차단 추가: $blockedName', 'ACTION');
  }

  void blacklistRemove(String blockedId) {
    send('BLACKLIST_REMOVE', {'blockedId': blockedId});
    addLog('🚫 차단 해제: $blockedId', 'ACTION');
  }

  void requestMailList() {
    send('MAIL_LIST', {});
    addLog('📧 메일 목록 조회...', 'ACTION');
  }

  void mailSend(String toName, String subject, String content, {int gold = 0, List<Map<String, dynamic>>? items}) {
    send('MAIL_SEND', {
      'toName': toName,
      'subject': subject,
      'content': content,
      'gold': gold,
      if (items != null) 'items': items,
    });
    addLog('📧 메일 전송: $toName', 'ACTION');
  }

  void mailRead(String mailId) {
    send('MAIL_READ', {'mailId': mailId});
    addLog('📧 메일 읽기: $mailId', 'ACTION');
  }

  void mailDelete(String mailId) {
    send('MAIL_DELETE', {'mailId': mailId});
    addLog('📧 메일 삭제: $mailId', 'ACTION');
  }

  void mailClaim(String mailId) {
    send('MAIL_CLAIM', {'mailId': mailId});
    addLog('📧 메일 보상 수령: $mailId', 'ACTION');
  }

  // ===== COLLECTION SYSTEM METHODS =====

  void requestBestiaryList() {
    send('BESTIARY_LIST', {});
    addLog('📖 도감 조회...', 'ACTION');
  }

  void requestTitleList() {
    send('TITLE_LIST', {});
    addLog('🏆 칭호 목록 조회...', 'ACTION');
  }

  void titleEquip(String titleId) {
    send('TITLE_EQUIP', {'titleId': titleId});
    addLog('🏆 칭호 장착: $titleId', 'ACTION');
  }

  void requestCollectibleList() {
    send('COLLECTIBLE_LIST', {});
    addLog('💎 수집품 목록 조회...', 'ACTION');
  }

  // ===== ECONOMY EXPANSION METHODS =====

  void requestBankInfo() {
    send('BANK_INFO', {});
    addLog('🏦 은행 정보 조회...', 'ACTION');
  }

  void bankDeposit(int amount) {
    send('BANK_DEPOSIT', {'amount': amount});
    addLog('🏦 입금 요청: $amount 골드', 'ACTION');
  }

  void bankWithdraw(int amount) {
    send('BANK_WITHDRAW', {'amount': amount});
    addLog('🏦 출금 요청: $amount 골드', 'ACTION');
  }

  void requestBankHistory({int limit = 50}) {
    send('BANK_HISTORY', {'limit': limit});
    addLog('🏦 거래 내역 조회...', 'ACTION');
  }

  void requestExchangeList({String? itemId, int limit = 50}) {
    send('EXCHANGE_LIST', {
      if (itemId != null) 'itemId': itemId,
      'limit': limit,
    });
    addLog('💱 거래소 목록 조회...', 'ACTION');
  }

  void exchangeSell(String itemId, int qty, int price) {
    send('EXCHANGE_SELL', {'itemId': itemId, 'qty': qty, 'price': price});
    addLog('💱 거래소 판매 등록: $itemId x$qty @$price', 'ACTION');
  }

  void exchangeBuy(String listingId, {int qty = 1}) {
    send('EXCHANGE_BUY', {'listingId': listingId, 'qty': qty});
    addLog('💱 거래소 구매: $listingId x$qty', 'ACTION');
  }

  void exchangeCancel(String listingId) {
    send('EXCHANGE_CANCEL', {'listingId': listingId});
    addLog('💱 거래소 취소: $listingId', 'ACTION');
  }

  // ===== ADMIN TOOLS METHODS =====

  void requestAdminStats() {
    send('ADMIN_STATS', {});
    addLog('📊 관리자 통계 조회...', 'ACTION');
  }
}
