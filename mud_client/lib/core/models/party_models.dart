/// Party member
class PartyMember {
  final String characterId;
  final String name;
  final int level;
  final String roomId;

  PartyMember({
    required this.characterId,
    required this.name,
    required this.level,
    required this.roomId,
  });

  factory PartyMember.fromJson(Map<String, dynamic> json) {
    return PartyMember(
      // 서버에서 null 이 오더라도 안전하게 처리
      characterId: json['characterId'] as String? ?? '',
      name: json['name'] as String? ?? '(알 수 없음)',
      level: (json['level'] as int?) ?? 1,
      roomId: json['roomId'] as String? ?? '',
    );
  }
}

/// Party info
class PartyInfo {
  final String partyId;
  final String code;
  final String leaderCharacterId;
  final List<PartyMember> members;
  final int ts;

  PartyInfo({
    required this.partyId,
    required this.code,
    required this.leaderCharacterId,
    required this.members,
    required this.ts,
  });

  factory PartyInfo.fromJson(Map<String, dynamic> json) {
    return PartyInfo(
      // 일부 필드가 null 이더라도 크래시 없이 기본값으로 처리
      partyId: json['partyId'] as String? ?? '',
      code: json['code'] as String? ?? '',
      leaderCharacterId: json['leaderCharacterId'] as String? ?? '',
      members: (json['members'] as List? ?? const [])
          .map((m) => PartyMember.fromJson(m as Map<String, dynamic>))
          .toList(),
      ts: (json['ts'] as int?) ?? 0,
    );
  }

  bool isLeader(String characterId) => leaderCharacterId == characterId;
  
  int get memberCount => members.length;
}

