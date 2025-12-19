import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Storage {
  static const _storage = FlutterSecureStorage();

  // Keys
  static const _keyToken = 'jwt_token';
  static const _keyRestUrl = 'rest_url';
  static const _keyWsUrl = 'ws_url';
  static const _keyDeveloperMode = 'developer_mode';

  // JWT Token
  static Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }

  // REST URL
  static Future<void> saveRestUrl(String url) async {
    await _storage.write(key: _keyRestUrl, value: url);
  }

  static Future<String?> getRestUrl() async {
    return await _storage.read(key: _keyRestUrl);
  }

  // WebSocket URL
  static Future<void> saveWsUrl(String url) async {
    await _storage.write(key: _keyWsUrl, value: url);
  }

  static Future<String?> getWsUrl() async {
    return await _storage.read(key: _keyWsUrl);
  }

  // Developer Mode
  static Future<bool> getDeveloperMode() async {
    final value = await _storage.read(key: _keyDeveloperMode);
    return value == 'true';
  }

  static Future<void> saveDeveloperMode(bool enabled) async {
    await _storage.write(key: _keyDeveloperMode, value: enabled.toString());
  }
}

