import 'package:shared_preferences/shared_preferences.dart';

class Storage {
  static SharedPreferences? _prefs;

  // shared_preferences 초기화
  static Future<void> _initSharedPrefs() async {
    if (_prefs == null) {
      _prefs = await SharedPreferences.getInstance();
    }
  }

  // shared_preferences 사용 (Windows ATL 문제 회피)
  static Future<void> _write(String key, String value) async {
    await _initSharedPrefs();
    await _prefs?.setString(key, value);
  }

  static Future<String?> _read(String key) async {
    await _initSharedPrefs();
    return _prefs?.getString(key);
  }

  static Future<void> _delete(String key) async {
    await _initSharedPrefs();
    await _prefs?.remove(key);
  }

  // Keys
  static const _keyToken = 'jwt_token';
  static const _keyRestUrl = 'rest_url';
  static const _keyWsUrl = 'ws_url';
  static const _keyDeveloperMode = 'developer_mode';

  // JWT Token
  static Future<void> saveToken(String token) async {
    await _write(_keyToken, token);
  }

  static Future<String?> getToken() async {
    return await _read(_keyToken);
  }

  static Future<void> deleteToken() async {
    await _delete(_keyToken);
  }

  // REST URL
  static Future<void> saveRestUrl(String url) async {
    await _write(_keyRestUrl, url);
  }

  static Future<String?> getRestUrl() async {
    return await _read(_keyRestUrl);
  }

  // WebSocket URL
  static Future<void> saveWsUrl(String url) async {
    await _write(_keyWsUrl, url);
  }

  static Future<String?> getWsUrl() async {
    return await _read(_keyWsUrl);
  }

  // Developer Mode
  static Future<bool> getDeveloperMode() async {
    final value = await _read(_keyDeveloperMode);
    return value == 'true';
  }

  static Future<void> saveDeveloperMode(bool enabled) async {
    await _write(_keyDeveloperMode, enabled.toString());
  }
}

