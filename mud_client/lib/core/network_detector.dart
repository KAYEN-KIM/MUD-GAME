import 'dart:async';
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:network_info_plus/network_info_plus.dart';
import 'package:http/http.dart' as http;

class NetworkDetector {
  static final NetworkInfo _networkInfo = NetworkInfo();
  static bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  static bool get _isIOS => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
  static bool get _isMobile => _isAndroid || _isIOS;

  /// 모바일 기기(Android/iOS)에서 PC의 서버 IP를 자동 감지
  /// 
  /// 1. 기기의 로컬 IP를 가져옴
  /// 2. 같은 서브넷의 IP들을 시도
  /// 3. 서버가 응답하는 IP를 반환
  static Future<String?> detectServerIp({int port = 3000}) async {
    if (!_isMobile) {
      return null; // 모바일(Android/iOS)만 지원
    }

    try {
      // 기기의 로컬 IP 가져오기
      final wifiIp = await _networkInfo.getWifiIP();
      if (wifiIp == null || wifiIp.isEmpty) {
        return null;
      }

      print('[NetworkDetector] 기기 IP: $wifiIp');

      // IP 주소 파싱 (예: 192.168.1.100 -> 192.168.1)
      final parts = wifiIp.split('.');
      if (parts.length != 4) {
        return null;
      }

      final subnet = '${parts[0]}.${parts[1]}.${parts[2]}';
      print('[NetworkDetector] 서브넷: $subnet.x');

      // 일반적인 게이트웨이 IP들 시도 (보통 .1)
      // 현재 PC IP들을 최우선순위로 포함
      final candidates = [
        // 최우선: 현재 PC IP (동적 감지)
        '$subnet.112', // 현재 PC IP (192.168.219.112)
        '192.168.219.112', // 현재 PC IP (고정)
        // 알려진 PC IP들
        '192.168.0.15', // 이전 PC IP (Wi-Fi 2)
        '192.168.0.10', // 이전 PC IP (Wi-Fi)
        // 서브넷 기반 PC IP (동적)
        '$subnet.15',
        '$subnet.10',
        // 게이트웨이 및 일반적인 IP 범위
        '$subnet.1', // 게이트웨이 (라우터)
        '$subnet.2',
        '$subnet.3',
        '$subnet.4',
        '$subnet.5',
        '$subnet.20',
        '$subnet.50',
        '$subnet.100',
        '$subnet.101',
        '$subnet.102',
        '$subnet.103',
        '$subnet.104',
        '$subnet.105',
        '$subnet.106',
        '$subnet.107',
        '$subnet.108',
        '$subnet.109',
        '$subnet.110',
        '$subnet.111',
        '$subnet.112', // 이전 PC IP (백업)
        '$subnet.113',
        '$subnet.114',
        '$subnet.115',
        // 백업: 이전 PC IP
        '192.168.219.112',
      ];

      // 중복 제거 및 정렬
      final uniqueCandidates = candidates.toSet().toList();

      print('[NetworkDetector] ${uniqueCandidates.length}개 IP 시도 중...');

      // 우선순위대로 순차적으로 시도 (빠른 응답을 위해)
      // 최우선 IP들 먼저 시도
      final priorityCandidates = uniqueCandidates.take(5).toList();
      final otherCandidates = uniqueCandidates.skip(5).toList();
      
      print('[NetworkDetector] 우선순위 IP ${priorityCandidates.length}개 먼저 시도...');
      
      // 우선순위 IP들을 병렬로 시도
      final priorityFutures = priorityCandidates.map((ip) => _testServer(ip, port));
      final priorityResults = await Future.wait(priorityFutures);
      
      // 우선순위 IP 중 성공한 것 찾기
      for (int i = 0; i < priorityResults.length; i++) {
        if (priorityResults[i] == true) {
          final foundIp = priorityCandidates[i];
          print('[NetworkDetector] ✅ 서버 발견 (우선순위): $foundIp:$port');
          return foundIp;
        }
      }
      
      // 우선순위에서 못 찾으면 나머지도 병렬로 시도
      if (otherCandidates.isNotEmpty) {
        print('[NetworkDetector] 나머지 IP ${otherCandidates.length}개 시도...');
        final otherFutures = otherCandidates.map((ip) => _testServer(ip, port));
        final otherResults = await Future.wait(otherFutures);
        
        for (int i = 0; i < otherResults.length; i++) {
          if (otherResults[i] == true) {
            final foundIp = otherCandidates[i];
            print('[NetworkDetector] ✅ 서버 발견: $foundIp:$port');
            return foundIp;
          }
        }
      }

      print('[NetworkDetector] 서버를 찾을 수 없음');
      return null;
    } catch (e) {
      print('[NetworkDetector] 오류: $e');
      return null;
    }
  }

  /// 특정 IP의 서버가 응답하는지 테스트
  static Future<bool> _testServer(String ip, int port) async {
    try {
      final url = 'http://$ip:$port/health';
      print('[NetworkDetector] Testing $url...');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'Connection': 'close'}, // 연결 즉시 종료
      ).timeout(
        const Duration(seconds: 2), // 타임아웃 2초로 단축 (빠른 감지)
        onTimeout: () {
          print('[NetworkDetector] $ip:$port 타임아웃');
          throw TimeoutException('Connection timeout');
        },
      );

      if (response.statusCode == 200) {
        print('[NetworkDetector] ✅ $ip:$port 응답 성공 (${response.statusCode})');
        return true;
      } else {
        print('[NetworkDetector] ❌ $ip:$port 응답 실패 (${response.statusCode})');
        return false;
      }
    } catch (e) {
      // 타임아웃이나 연결 실패는 정상 (해당 IP에 서버가 없음)
      // 너무 많은 로그를 방지하기 위해 에러는 출력하지 않음
      return false;
    }
  }

  /// 기기의 로컬 IP 주소 가져오기
  static Future<String?> getLocalIp() async {
    try {
      if (_isMobile) {
        return await _networkInfo.getWifiIP();
      }
      return null;
    } catch (e) {
      print('[NetworkDetector] IP 가져오기 오류: $e');
      return null;
    }
  }
}

class TimeoutException implements Exception {
  final String message;
  TimeoutException(this.message);
  @override
  String toString() => message;
}

