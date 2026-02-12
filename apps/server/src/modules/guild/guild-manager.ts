// 길드 시스템 데이터 모델

export interface Guild {
  id: string;
  name: string;
  description: string;
  leaderId: string;
  level: number;
  exp: number;
  maxMembers: number;
  members: GuildMember[];
  createdAt: Date;
}

export interface GuildMember {
  characterId: string;
  characterName: string;
  rank: 'LEADER' | 'OFFICER' | 'MEMBER';
  joinedAt: Date;
  contributionPoints: number;
}

const guilds = new Map<string, Guild>();

export function createGuild(name: string, leaderId: string, leaderName: string, description: string = ''): Guild {
  const guildId = `guild_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const guild: Guild = {
    id: guildId,
    name,
    description,
    leaderId,
    level: 1,
    exp: 0,
    maxMembers: 20,
    members: [
      {
        characterId: leaderId,
        characterName: leaderName,
        rank: 'LEADER',
        joinedAt: new Date(),
        contributionPoints: 0,
      },
    ],
    createdAt: new Date(),
  };

  guilds.set(guildId, guild);
  return guild;
}

export function getGuild(guildId: string): Guild | undefined {
  return guilds.get(guildId);
}

export function getGuildByName(name: string): Guild | undefined {
  return [...guilds.values()].find((g) => g.name === name);
}

export function getGuildByCharacter(characterId: string): Guild | undefined {
  return [...guilds.values()].find((g) => g.members.some((m) => m.characterId === characterId));
}

export function addGuildMember(guildId: string, characterId: string, characterName: string): void {
  const guild = guilds.get(guildId);
  if (!guild) throw new Error('Guild not found');
  if (guild.members.length >= guild.maxMembers) throw new Error('Guild is full');

  guild.members.push({
    characterId,
    characterName,
    rank: 'MEMBER',
    joinedAt: new Date(),
    contributionPoints: 0,
  });
}

export function removeGuildMember(guildId: string, characterId: string): void {
  const guild = guilds.get(guildId);
  if (!guild) throw new Error('Guild not found');

  guild.members = guild.members.filter((m) => m.characterId !== characterId);
}

export function promoteGuildMember(guildId: string, characterId: string): void {
  const guild = guilds.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const member = guild.members.find((m) => m.characterId === characterId);
  if (!member) throw new Error('Member not found');

  if (member.rank === 'MEMBER') {
    member.rank = 'OFFICER';
  }
}

export function demoteGuildMember(guildId: string, characterId: string): void {
  const guild = guilds.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const member = guild.members.find((m) => m.characterId === characterId);
  if (!member) throw new Error('Member not found');

  if (member.rank === 'OFFICER') {
    member.rank = 'MEMBER';
  }
}

export function disbandGuild(guildId: string): void {
  guilds.delete(guildId);
}

export function getAllGuilds(): Guild[] {
  return [...guilds.values()];
}

