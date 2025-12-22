import 'dart:io';
import 'dart:async';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:http/http.dart' as http;

class NetworkDetector {
  static final NetworkInfo _networkInfo = NetworkInfo();

  /// Android 기기에서 PC의 서버 IP를 자동 감지
  /// 
  /// 1. 기기의 로컬 IP를 가져옴
  /// 2. 같은 서브넷의 IP들을 시도
  /// 3. 서버가 응답하는 IP를 반환
  static Future<String?> detectServerIp({int port = 3000}) async {
    if (!Platform.isAndroid) {
      return null; // Android만 지원
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
      // 현재 PC IP들을 우선순위로 포함
      final candidates = [
        '192.168.0.15', // 현재 PC IP (Wi-Fi 2)
        '192.168.0.10', // 현재 PC IP (Wi-Fi)
        '192.168.219.112', // 이전 PC IP (백업)
        '$subnet.15', // 서브넷 기반 PC IP
        '$subnet.10', // 서브넷 기반 PC IP
        '$subnet.112', // 서브넷 기반 PC IP
        '$subnet.1', // 게이트웨이 (라우터)
        '$subnet.2',
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
        '$subnet.113',
        '$subnet.114',
        '$subnet.115',
      ];

      // 중복 제거 및 정렬
      final uniqueCandidates = candidates.toSet().toList();

      print('[NetworkDetector] ${uniqueCandidates.length}개 IP 시도 중...');

      // 병렬로 여러 IP 시도
      final futures = uniqueCandidates.map((ip) => _testServer(ip, port));
      final results = await Future.wait(futures);

      // 성공한 IP 찾기
      for (int i = 0; i < results.length; i++) {
        if (results[i] == true) {
          final foundIp = uniqueCandidates[i];
          print('[NetworkDetector] 서버 발견: $foundIp:$port');
          return foundIp;
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
      final response = await http.get(
        Uri.parse(url),
      ).timeout(
        const Duration(seconds: 3), // 타임아웃 증가 (2초 -> 3초)
        onTimeout: () => throw TimeoutException('Connection timeout'),
      );

      if (response.statusCode == 200) {
        print('[NetworkDetector] $ip:$port 응답 성공');
        return true;
      }
      return false;
    } catch (e) {
      // 타임아웃이나 연결 실패는 정상 (해당 IP에 서버가 없음)
      return false;
    }
  }

  /// 기기의 로컬 IP 주소 가져오기
  static Future<String?> getLocalIp() async {
    try {
      if (Platform.isAndroid) {
        return await _networkInfo.getWifiIP();
      }
      // 다른 플랫폼은 NetworkInterface 사용
      final interfaces = await NetworkInterface.list();
      for (var interface in interfaces) {
        for (var addr in interface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            return addr.address;
          }
        }
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

