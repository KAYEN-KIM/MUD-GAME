/// 시즌 상태 정보 (서버에서 받은 UTC ms 기준)
class SeasonStatus {
  final int serverNowUtcMs;
  final int currentSeason;
  final int seasonStartUtcMs;
  final int seasonEndUtcMs;
  final int nextDailyResetUtcMs;
  final int nextWeeklyResetUtcMs;
  final int seasonLengthDays;
  final int dayIndexInSeason;
  final int? maxUnlockedSeason; // Season Lock: 최대 잠금 해제 시즌

  SeasonStatus({
    required this.serverNowUtcMs,
    required this.currentSeason,
    required this.seasonStartUtcMs,
    required this.seasonEndUtcMs,
    required this.nextDailyResetUtcMs,
    required this.nextWeeklyResetUtcMs,
    required this.seasonLengthDays,
    required this.dayIndexInSeason,
    this.maxUnlockedSeason, // Optional (default 99 if missing)
  });

  factory SeasonStatus.fromJson(Map<String, dynamic> json) {
    return SeasonStatus(
      serverNowUtcMs: json['serverNowUtcMs'] as int,
      currentSeason: json['currentSeason'] as int,
      seasonStartUtcMs: json['seasonStartUtcMs'] as int,
      seasonEndUtcMs: json['seasonEndUtcMs'] as int,
      nextDailyResetUtcMs: json['nextDailyResetUtcMs'] as int,
      nextWeeklyResetUtcMs: json['nextWeeklyResetUtcMs'] as int,
      seasonLengthDays: json['seasonLengthDays'] as int,
      dayIndexInSeason: json['dayIndexInSeason'] as int,
      maxUnlockedSeason: json['maxUnlockedSeason'] as int?, // Optional field
    );
  }

  /// 일일 리셋까지 남은 시간 (ms)
  int get dailyResetRemainingMs {
    final now = DateTime.now().millisecondsSinceEpoch;
    final serverNow = serverNowUtcMs;
    final serverOffset = now - serverNow;
    return (nextDailyResetUtcMs + serverOffset) - now;
  }

  /// 주간 리셋까지 남은 시간 (ms)
  int get weeklyResetRemainingMs {
    final now = DateTime.now().millisecondsSinceEpoch;
    final serverNow = serverNowUtcMs;
    final serverOffset = now - serverNow;
    return (nextWeeklyResetUtcMs + serverOffset) - now;
  }

  /// 시즌 종료까지 남은 시간 (ms)
  int get seasonEndRemainingMs {
    final now = DateTime.now().millisecondsSinceEpoch;
    final serverNow = serverNowUtcMs;
    final serverOffset = now - serverNow;
    return (seasonEndUtcMs + serverOffset) - now;
  }
}

