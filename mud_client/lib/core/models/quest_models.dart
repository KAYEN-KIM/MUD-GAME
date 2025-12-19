/// 퀘스트 cadence 타입
enum QuestCadence {
  daily,
  weekly,
  meta,
  story,
}

/// 퀘스트 상태
enum QuestStatus {
  available,
  active,
  completed,
  turnedIn,
}

/// 퀘스트 템플릿 뷰 (수락 가능)
class QuestTemplateView {
  final String questId;
  final String title;
  final String description;
  final String giverRoomId;
  final String turninRoomId;
  final bool repeatable;
  final QuestCadence? cadence;

  QuestTemplateView({
    required this.questId,
    required this.title,
    required this.description,
    required this.giverRoomId,
    required this.turninRoomId,
    required this.repeatable,
    this.cadence,
  });

  factory QuestTemplateView.fromJson(Map<String, dynamic> json) {
    QuestCadence? cadence;
    final cadenceStr = json['cadence'] as String?;
    if (cadenceStr != null) {
      switch (cadenceStr.toUpperCase()) {
        case 'DAILY':
          cadence = QuestCadence.daily;
          break;
        case 'WEEKLY':
          cadence = QuestCadence.weekly;
          break;
        case 'META':
          cadence = QuestCadence.meta;
          break;
        case 'STORY':
          cadence = QuestCadence.story;
          break;
      }
    }

    return QuestTemplateView(
      questId: json['questId'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      giverRoomId: json['giverRoomId'] as String,
      turninRoomId: json['turninRoomId'] as String,
      repeatable: json['repeatable'] as bool? ?? false,
      cadence: cadence,
    );
  }
}

/// 퀘스트 진행 뷰 (진행 중/완료)
class QuestActiveView {
  final String questId;
  final String title;
  final QuestStatus status;
  final String progressSummary; // "12/60"
  final String giverRoomId;
  final String turninRoomId;
  final bool repeatable;
  final QuestCadence? cadence;

  QuestActiveView({
    required this.questId,
    required this.title,
    required this.status,
    required this.progressSummary,
    required this.giverRoomId,
    required this.turninRoomId,
    required this.repeatable,
    this.cadence,
  });

  factory QuestActiveView.fromJson(Map<String, dynamic> json) {
    QuestStatus status;
    final statusStr = json['status'] as String?;
    switch (statusStr?.toUpperCase()) {
      case 'ACTIVE':
        status = QuestStatus.active;
        break;
      case 'COMPLETED':
        status = QuestStatus.completed;
        break;
      case 'TURNED_IN':
        status = QuestStatus.turnedIn;
        break;
      default:
        status = QuestStatus.active;
    }

    QuestCadence? cadence;
    final cadenceStr = json['cadence'] as String?;
    if (cadenceStr != null) {
      switch (cadenceStr.toUpperCase()) {
        case 'DAILY':
          cadence = QuestCadence.daily;
          break;
        case 'WEEKLY':
          cadence = QuestCadence.weekly;
          break;
        case 'META':
          cadence = QuestCadence.meta;
          break;
        case 'STORY':
          cadence = QuestCadence.story;
          break;
      }
    }

    return QuestActiveView(
      questId: json['questId'] as String,
      title: json['title'] as String,
      status: status,
      progressSummary: json['progressSummary'] as String? ?? '0/0',
      giverRoomId: json['giverRoomId'] as String,
      turninRoomId: json['turninRoomId'] as String,
      repeatable: json['repeatable'] as bool? ?? false,
      cadence: cadence,
    );
  }

  /// 진행도 파싱 (예: "12/60" -> current: 12, total: 60)
  int get progressCurrent {
    final parts = progressSummary.split('/');
    if (parts.length >= 1) {
      return int.tryParse(parts[0]) ?? 0;
    }
    return 0;
  }

  int get progressTotal {
    final parts = progressSummary.split('/');
    if (parts.length >= 2) {
      return int.tryParse(parts[1]) ?? 0;
    }
    return 0;
  }

  double get progressRatio {
    if (progressTotal == 0) return 0.0;
    return (progressCurrent / progressTotal).clamp(0.0, 1.0);
  }
}

