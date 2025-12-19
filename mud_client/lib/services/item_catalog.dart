import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// 아이템 카탈로그 싱글톤 서비스
/// assets/catalog/items_catalog.json을 로드하여 itemId -> name 매핑 제공
class ItemCatalog {
  static final ItemCatalog _instance = ItemCatalog._internal();
  factory ItemCatalog() => _instance;
  ItemCatalog._internal();

  static ItemCatalog get instance => _instance;

  final Map<String, Map<String, dynamic>> _catalog = {};
  bool _isLoaded = false;

  /// 카탈로그 로드 (앱 시작 시 1회 호출)
  Future<void> load() async {
    if (_isLoaded) return;

    try {
      final jsonString = await rootBundle.loadString('assets/catalog/items_catalog.json');
      final Map<String, dynamic> data = jsonDecode(jsonString);
      
      data.forEach((key, value) {
        _catalog[key] = value as Map<String, dynamic>;
      });

      _isLoaded = true;
      if (kDebugMode) {
        debugPrint('[ItemCatalog] Loaded ${_catalog.length} items');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ItemCatalog] Failed to load: $e');
      }
      // 실패해도 앱은 계속 작동 (fallback to itemId)
    }
  }

  /// itemId로 아이템 이름 조회 (없으면 itemId 그대로 반환)
  String getName(String? itemId) {
    if (itemId == null || itemId.isEmpty) return '';
    return _catalog[itemId]?['name'] ?? itemId;
  }

  /// 카탈로그 로드 여부 확인
  bool get isLoaded => _isLoaded;

  /// 카탈로그 크기
  int get size => _catalog.length;
}

