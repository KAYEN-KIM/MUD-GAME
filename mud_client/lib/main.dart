import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'app.dart';
import 'services/item_catalog.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 아이템 카탈로그 로드 (실패해도 앱 계속 실행)
  try {
    await ItemCatalog.instance.load();
  } catch (e) {
    if (kDebugMode) {
      debugPrint('[ItemCatalog] Load failed: $e');
    }
  }
  
  runApp(const MudApp());
}

