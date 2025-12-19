import 'dart:async';

/// RequestTracker: reqId 기반 요청-응답 매칭 유틸리티
/// 
/// WebSocket 메시지를 reqId로 추적하여 비동기 응답을 처리합니다.
/// - 중복 클릭 방지
/// - 타임아웃 자동 처리
/// - 스레드 안전
class RequestTracker {
  final Map<String, Completer<dynamic>> _pending = {};
  final Duration defaultTimeout;

  RequestTracker({this.defaultTimeout = const Duration(seconds: 10)});

  /// 새 요청을 추적 시작하고 Future 반환
  /// [reqId]는 고유해야 합니다.
  Future<T> waitFor<T>(String reqId, {Duration? timeout}) {
    // 이미 pending 중이면 에러 (중복 요청 방지)
    if (_pending.containsKey(reqId)) {
      throw Exception('Request already pending: $reqId');
    }

    final completer = Completer<T>();
    _pending[reqId] = completer;

    // 타임아웃 설정
    final timeoutDuration = timeout ?? defaultTimeout;
    Timer(timeoutDuration, () {
      if (_pending.containsKey(reqId) && !completer.isCompleted) {
        _pending.remove(reqId);
        completer.completeError(TimeoutException(
          'Request timeout: $reqId',
          timeoutDuration,
        ));
      }
    });

    return completer.future as Future<T>;
  }

  /// 요청 완료 (성공)
  void complete(String reqId, dynamic result) {
    final completer = _pending.remove(reqId);
    if (completer != null && !completer.isCompleted) {
      completer.complete(result);
    }
  }

  /// 요청 완료 (실패)
  void completeError(String reqId, Object error, [StackTrace? stackTrace]) {
    final completer = _pending.remove(reqId);
    if (completer != null && !completer.isCompleted) {
      completer.completeError(error, stackTrace);
    }
  }

  /// 특정 요청이 pending 중인지 확인
  bool isPending(String reqId) {
    return _pending.containsKey(reqId);
  }

  /// 모든 pending 요청 취소
  void cancelAll() {
    for (final completer in _pending.values) {
      if (!completer.isCompleted) {
        completer.completeError(Exception('Request cancelled'));
      }
    }
    _pending.clear();
  }

  /// Pending 요청 개수
  int get pendingCount => _pending.length;
}

/// ShopBuyError: 상점 구매 실패 에러
class ShopBuyError implements Exception {
  final String code;
  final String message;
  final String? itemId;

  ShopBuyError({
    required this.code,
    required this.message,
    this.itemId,
  });

  @override
  String toString() => 'ShopBuyError($code): $message';

  /// 에러 코드를 사용자 친화적 메시지로 변환
  String toUserMessage() {
    switch (code) {
      case 'INSUFFICIENT_FUNDS':
      case 'INSUFFICIENT_GOLD':
        return '골드가 부족합니다.';
      case 'INSUFFICIENT_ITEM':
      case 'INSUFFICIENT_COST':
        return '필요한 재화가 부족합니다.';
      case 'NOT_FOUND':
      case 'SHOP_NOT_FOUND':
      case 'ITEM_NOT_FOUND':
        return '상점 또는 아이템을 찾을 수 없습니다.\n(콘텐츠 업데이트 필요)';
      case 'RATE_LIMIT':
        return '요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.';
      case 'INVALID_REQ':
      case 'INVALID_REQUEST':
        return '잘못된 요청입니다.';
      case 'CHARACTER_BUSY':
        return '다른 작업을 진행 중입니다.';
      default:
        return message.isNotEmpty ? message : '구매에 실패했습니다.';
    }
  }
}

/// ShopBuyResult: 상점 구매 성공 결과
class ShopBuyResult {
  final String itemId;
  final int qty;
  final Map<String, int> balances;
  final Map<String, int>? cost;
  
  ShopBuyResult({
    required this.itemId,
    required this.qty,
    required this.balances,
    this.cost,
  });

  factory ShopBuyResult.fromJson(Map<String, dynamic> json) {
    return ShopBuyResult(
      itemId: json['itemId'] as String? ?? '',
      qty: json['qty'] as int? ?? 1,
      balances: _parseBalances(json['balances']),
      cost: json['cost'] != null ? _parseCost(json['cost']) : null,
    );
  }

  static Map<String, int> _parseBalances(dynamic balances) {
    if (balances == null) return {};
    if (balances is Map) {
      return balances.map((k, v) => MapEntry(k.toString(), (v as num).toInt()));
    }
    return {};
  }

  static Map<String, int> _parseCost(dynamic cost) {
    if (cost is Map) {
      return cost.map((k, v) => MapEntry(k.toString(), (v as num).toInt()));
    }
    return {};
  }
}

