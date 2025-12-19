import 'dart:io';

class Endpoints {
  // 플랫폼별 기본 URL
  static String getDefaultRestUrl() {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000'; // Android 에뮬레이터
    }
    return 'http://localhost:3000'; // Desktop/iOS
  }

  static String getDefaultWsUrl() {
    if (Platform.isAndroid) {
      return 'ws://10.0.2.2:3000'; // Android 에뮬레이터
    }
    return 'ws://localhost:3000'; // Desktop/iOS
  }
}

