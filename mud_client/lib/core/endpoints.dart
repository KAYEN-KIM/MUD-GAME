import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'network_detector.dart';

class Endpoints {
  static String? _cachedServerIp;
  static bool _isDetecting = false;

  static bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  static bool get _isIOS => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
  static bool get _isMobile => _isAndroid || _isIOS;

  // 플랫폼별 기본 URL
  static String getDefaultRestUrl() {
    if (_isAndroid) {
      // Android: 실제 기기는 PC IP 필요, 에뮬레이터는 10.0.2.2
      // 기본값은 10.0.2.2 (에뮬레이터용)
      // 실제 기기 사용 시 자동 감지 또는 설정 화면에서 PC IP로 변경 필요
      return 'http://10.0.2.2:3000'; // Android 에뮬레이터 기본값
    }
    return 'http://localhost:3000'; // Desktop/iOS 시뮬레이터/웹
  }

  static String getDefaultWsUrl() {
    if (_isAndroid) {
      // Android: 실제 기기는 PC IP 필요, 에뮬레이터는 10.0.2.2
      // 기본값은 10.0.2.2 (에뮬레이터용)
      // 실제 기기 사용 시 자동 감지 또는 설정 화면에서 PC IP로 변경 필요
      return 'ws://10.0.2.2:3000'; // Android 에뮬레이터 기본값
    }
    return 'ws://localhost:3000'; // Desktop/iOS 시뮬레이터/웹
  }

  /// 모바일(Android/iOS) 실제 기기에서 서버 IP 자동 감지
  /// 감지된 IP를 캐시하여 재사용
  static Future<String?> detectServerIp({int port = 3000}) async {
    if (!_isMobile) {
      return null;
    }

    // 이미 감지 중이면 대기
    if (_isDetecting) {
      while (_isDetecting) {
        await Future.delayed(const Duration(milliseconds: 100));
      }
      return _cachedServerIp;
    }

    // 캐시된 IP가 있으면 반환
    if (_cachedServerIp != null) {
      return _cachedServerIp;
    }

    _isDetecting = true;
    try {
      _cachedServerIp = await NetworkDetector.detectServerIp(port: port);
      return _cachedServerIp;
    } finally {
      _isDetecting = false;
    }
  }

  /// 캐시 초기화 (설정 변경 시 호출)
  static void clearCache() {
    _cachedServerIp = null;
  }

  /// 감지된 IP로 REST URL 생성
  static Future<String> getAutoDetectedRestUrl({int port = 3000}) async {
    if (_isMobile) {
      final serverIp = await detectServerIp(port: port);
      if (serverIp != null) {
        return 'http://$serverIp:$port';
      }
    }
    return getDefaultRestUrl();
  }

  /// 감지된 IP로 WS URL 생성
  static Future<String> getAutoDetectedWsUrl({int port = 3000}) async {
    if (_isMobile) {
      final serverIp = await detectServerIp(port: port);
      if (serverIp != null) {
        return 'ws://$serverIp:$port';
      }
    }
    return getDefaultWsUrl();
  }
}

