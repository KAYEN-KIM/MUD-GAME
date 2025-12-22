# Real-time MUD Combat v1 - Tick + Queue + Autoswing

## Overview

This PR implements a real-time, tick-based combat system for the MUD game. Combat never pauses and advances in fixed intervals (default 2 seconds per tick). Player commands are queued and executed on eligible ticks, while basic attacks happen automatically via autoswing mechanics.

## Key Features

- **Real-time Combat Loop**: Combat advances every 2 seconds regardless of player input
- **Command Queueing**: Player actions (ATTACK, FLEE) are ACKed immediately and executed on the next eligible tick
- **Autoswing**: Automatic basic attacks when no queued action is available
- **Persistent State**: Combat state stored in DB, survives server restarts
- **Distributed Safety**: Redis locks ensure no double-processing across multiple server instances
- **Room Broadcasts**: All players in the same room receive COMBAT_TICK events

## Architecture

### Database Schema

Added three new models to support tick-based combat:

1. **CombatInstance**: Represents an active combat in a room
   - Tracks current tick, next tick time, and combat state (IDLE/ENGAGED/RESOLVING/ENDED)
   - Indexed on `nextTickAt` for efficient polling

2. **CombatCombatant**: Represents a participant in combat (player or monster)
   - Stores current HP/MP, stats snapshot, and action timings
   - Tracks next action time and next autoswing time

3. **CombatActionQueue**: Queue of pending actions for each combatant
   - Idempotent via unique `reqId` per combatant
   - Ordered by `seq` number

### Module Structure

```
apps/server/src/modules/combat-tick/
├── combat-tick.module.ts       # NestJS module registration
├── combat-tick.service.ts      # Core combat logic (state management, damage calc)
├── combat-tick.worker.ts       # Tick polling and distributed locking
├── combat-tick.types.ts        # TypeScript interfaces
└── combat-tick.util.ts         # Damage formulas and log formatting
```

### Components

1. **CombatTickService**
   - `ensureInstanceForRoom()`: Creates or reuses combat instances
   - `ensureCombatants()`: Adds player and monster to combat
   - `enqueueAction()`: Queues player commands with idempotency
   - `processTick()`: Advances combat by one tick, applies damage, checks victory/defeat

2. **CombatTickWorker**
   - Polls every 250ms for combat instances where `nextTickAt <= now`
   - Acquires Redis lock (`lock:combat:<instanceId>`) with 5s TTL
   - Processes tick and broadcasts results via Redis pub/sub
   - Gracefully releases locks even on errors

3. **WS Gateway Integration**
   - New message types: `ATTACK`, `KILL`, `FLEE`
   - Subscribes to `combat:tick:*` Redis channel
   - Broadcasts `COMBAT_TICK` events to all clients in the same room

## Environment Variables

Add these to your `.env` file (defaults shown):

```env
COMBAT_TICK_MS=2000              # Time between combat ticks
COMBAT_AUTOSWING_MS=2000         # Autoswing interval
COMBAT_ROUNDTIME_MS=2000         # Cooldown after manual actions
COMBAT_TICK_POLL_MS=250          # Worker polling frequency
```

## How to Use

### 1. Start the Server

```bash
cd apps/server
pnpm dev
```

The `CombatTickWorker` will automatically start and begin polling for due combat instances.

### 2. Identify a Monster in Your Room

Monsters are defined by `RoomSpawn` entries. To find available monsters in your current room:

```sql
SELECT rs.monsterId, m.name, m.level, m.hp, m.atk, m.def
FROM "RoomSpawn" rs
JOIN "Monster" m ON rs.monsterId = m.id
WHERE rs.roomId = 'YOUR_CURRENT_ROOM_ID';
```

Or use existing game commands to see room details.

### 3. Initiate Combat

Send a WebSocket message:

```json
{
  "t": "ATTACK",
  "reqId": "req_12345",
  "p": {
    "target": "MONSTER_ID"
  }
}
```

Aliases: `KILL` works the same as `ATTACK`.

**Response (ACK):**
```json
{
  "t": "ATTACK_ACK",
  "reqId": "req_12345",
  "ts": 1234567890,
  "p": {
    "accepted": true,
    "instanceId": "clx1234567890"
  }
}
```

### 4. Observe Combat Ticks

Every ~2 seconds, all clients in the room will receive:

```json
{
  "t": "COMBAT_TICK",
  "ts": 1234567890,
  "p": {
    "instanceId": "clx1234567890",
    "tick": 5,
    "lines": [
      "You swing at Goblin for 7 damage. (23/30 HP)",
      "Goblin hits you for 3 damage. (47/50 HP)"
    ],
    "delta": {
      "combatants": [
        {
          "combatantId": "clx_combatant_1",
          "hpBefore": 50,
          "hpAfter": 47
        },
        {
          "combatantId": "clx_combatant_2",
          "hpBefore": 30,
          "hpAfter": 23
        }
      ]
    },
    "events": [],
    "ended": false
  }
}
```

### 5. Flee from Combat

```json
{
  "t": "FLEE",
  "reqId": "req_67890",
  "p": {}
}
```

Flee has a 50% success rate (configurable). On success, the combatant is removed from combat.

### 6. Restart Server Mid-Combat

Combat state is persisted in the database. When you restart the server:

1. The `CombatTickWorker` resumes polling
2. Overdue ticks are processed immediately
3. Combat continues seamlessly

## Technical Details

### Damage Formula

```typescript
damage = max(1, atk - def + random(-2, +2))
```

- Player stats: Calculated from `Character.str` + equipped items
- Monster stats: From `Monster.atk/def` in DB
- Always deals at least 1 damage

### Concurrency Safety

- Redis distributed lock prevents double-processing
- Lock key: `lock:combat:<instanceId>`
- TTL: 5 seconds (longer than expected tick duration)
- Lua script for atomic lock release

### State Machine

Combat instances follow this state flow:

```
IDLE → ENGAGED ↔ RESOLVING → ENDED
```

- **ENGAGED**: Ready for tick processing
- **RESOLVING**: Currently being processed (prevents double-processing)
- **ENDED**: Combat finished (victory/defeat/flee)

## Testing

### Manual Verification

1. **Start Combat**
   - Send `ATTACK` with a valid monster ID
   - Verify `ATTACK_ACK` received
   - Verify initial combat log

2. **Observe Ticks**
   - Wait for `COMBAT_TICK` events (~2s apart)
   - Verify damage is applied
   - Verify HP decreases

3. **Victory/Defeat**
   - Let combat run until one side reaches 0 HP
   - Verify `COMBAT_END` event
   - Verify instance state is `ENDED`

4. **Server Restart**
   - Start combat
   - Restart server mid-fight
   - Verify combat resumes automatically
   - Verify tick timing is correct

5. **Flee**
   - Send `FLEE` command
   - Verify flee success/failure
   - If successful, verify combatant removed

### Smoke Tests

```bash
pnpm -w lint
pnpm -w test  # if tests exist
```

## Future Enhancements

This is v1 - a vertical slice focusing on 1v1 combat. Future work:

- **Party Combat**: Multiple players vs multiple monsters
- **Status Effects**: Poison, stun, buffs, debuffs
- **Spellcasting**: `CAST` action with cast times
- **Item Usage**: `USE_ITEM` in combat
- **Boss Mechanics**: Special abilities, phases
- **Loot Distribution**: Drops and rewards on victory
- **Combat Events**: More granular event types for UI

## Migration

No data migration required. The new tables are additive and don't affect existing data.

## Performance Considerations

- Polling interval: 250ms is efficient for <100 concurrent combats
- Redis pub/sub: Scales well for room broadcasts
- DB queries: Indexed on `nextTickAt` for fast polling
- Lock contention: Minimal with proper TTL and cleanup

## Files Changed

### New Files
- `apps/server/prisma/schema.prisma` (3 new models)
- `apps/server/src/modules/combat-tick/*` (5 files)
- `docs/COMBAT_V1.md` (this file)

### Modified Files
- `apps/server/src/app.module.ts` (register `CombatTickModule`)
- `apps/server/src/modules/ws/ws.module.ts` (import `CombatTickModule`)
- `apps/server/src/modules/ws/ws.gateway.ts` (add ATTACK/FLEE handlers, Redis subscription)
- `apps/server/src/common/config/env.validation.ts` (add combat config)

## Questions?

For questions or issues, check the server logs for `[CombatTickWorker]` and `[CombatTickService]` prefixes.

