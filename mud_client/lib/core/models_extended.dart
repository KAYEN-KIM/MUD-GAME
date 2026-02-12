class SkillView {
  final String id;
  final String name;
  final String type; // PASSIVE, ACTIVE, TOGGLE
  final String category; // COMBAT, DEFENSE, SUPPORT, UTILITY
  final int maxLevel;
  final String description;
  final int requiredLevel;
  final List<Map<String, dynamic>>? requiredSkills;
  final int currentLevel;
  final bool canLearn;

  SkillView({
    required this.id,
    required this.name,
    required this.type,
    required this.category,
    required this.maxLevel,
    required this.description,
    required this.requiredLevel,
    this.requiredSkills,
    this.currentLevel = 0,
    this.canLearn = false,
  });

  factory SkillView.fromJson(Map<String, dynamic> json) {
    return SkillView(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      category: json['category'] as String,
      maxLevel: json['maxLevel'] as int,
      description: json['description'] as String,
      requiredLevel: json['requiredLevel'] as int,
      requiredSkills: json['requiredSkills'] != null
          ? List<Map<String, dynamic>>.from(json['requiredSkills'] as List)
          : null,
      currentLevel: json['currentLevel'] as int? ?? 0,
      canLearn: json['canLearn'] as bool? ?? false,
    );
  }
}

class DungeonView {
  final String id;
  final String name;
  final String description;
  final int minLevel;
  final int maxPartySize;
  final int recommendedLevel;
  final List<String> difficulties;

  DungeonView({
    required this.id,
    required this.name,
    required this.description,
    required this.minLevel,
    required this.maxPartySize,
    required this.recommendedLevel,
    required this.difficulties,
  });

  factory DungeonView.fromJson(Map<String, dynamic> json) {
    return DungeonView(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      minLevel: json['minLevel'] as int,
      maxPartySize: json['maxPartySize'] as int,
      recommendedLevel: json['recommendedLevel'] as int,
      difficulties: List<String>.from(json['difficulties'] as List),
    );
  }
}

class TradeOffer {
  final String offerId;
  final String fromCharacterId;
  final String fromCharacterName;
  final String toCharacterId;
  final List<Map<String, dynamic>> offeredItems;
  final int offeredGold;
  final List<Map<String, dynamic>> requestedItems;
  final int requestedGold;
  final String status; // PENDING, ACCEPTED, REJECTED, CANCELLED
  final DateTime createdAt;

  TradeOffer({
    required this.offerId,
    required this.fromCharacterId,
    required this.fromCharacterName,
    required this.toCharacterId,
    required this.offeredItems,
    required this.offeredGold,
    required this.requestedItems,
    required this.requestedGold,
    required this.status,
    required this.createdAt,
  });

  factory TradeOffer.fromJson(Map<String, dynamic> json) {
    return TradeOffer(
      offerId: json['offerId'] as String,
      fromCharacterId: json['fromCharacterId'] as String,
      fromCharacterName: json['fromCharacterName'] as String,
      toCharacterId: json['toCharacterId'] as String,
      offeredItems: List<Map<String, dynamic>>.from(json['offeredItems'] as List),
      offeredGold: json['offeredGold'] as int,
      requestedItems: List<Map<String, dynamic>>.from(json['requestedItems'] as List),
      requestedGold: json['requestedGold'] as int,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class GuildView {
  final String id;
  final String name;
  final String description;
  final int level;
  final int memberCount;
  final int maxMembers;
  final String leaderId;
  final String leaderName;
  final DateTime createdAt;

  GuildView({
    required this.id,
    required this.name,
    required this.description,
    required this.level,
    required this.memberCount,
    required this.maxMembers,
    required this.leaderId,
    required this.leaderName,
    required this.createdAt,
  });

  factory GuildView.fromJson(Map<String, dynamic> json) {
    return GuildView(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      level: json['level'] as int,
      memberCount: json['memberCount'] as int,
      maxMembers: json['maxMembers'] as int,
      leaderId: json['leaderId'] as String,
      leaderName: json['leaderName'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class AchievementView {
  final String id;
  final String name;
  final String description;
  final String category;
  final int progress;
  final int maxProgress;
  final bool completed;
  final DateTime? completedAt;
  final Map<String, dynamic>? rewards;

  AchievementView({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.progress,
    required this.maxProgress,
    required this.completed,
    this.completedAt,
    this.rewards,
  });

  factory AchievementView.fromJson(Map<String, dynamic> json) {
    return AchievementView(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      category: json['category'] as String,
      progress: json['progress'] as int,
      maxProgress: json['maxProgress'] as int,
      completed: json['completed'] as bool,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      rewards: json['rewards'] as Map<String, dynamic>?,
    );
  }
}

