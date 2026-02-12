# MUD Server Environment Configuration

## Quick Start

Copy this file to `.env` and update values as needed:
```bash
cp .env.example .env
```

## Core Settings

```bash
NODE_ENV=development
PORT=3000
TZ=Asia/Seoul
```

## Database & Redis

```bash
DATABASE_URL=postgresql://mud:mudpass@localhost:5432/mud?schema=public
REDIS_URL=redis://localhost:6379
```

## Authentication

```bash
JWT_SECRET=change-me-in-production
ADMIN_KEY=change-me-in-production
```

## Rate Limits

```bash
RL_CHAT_PER_SEC=1          # Chat messages per second
RL_MOVE_PER_SEC=3          # Movement commands per second
CD_HUNT_MS=2000            # Hunt cooldown (ms)
RL_COMBAT_TURN_PER_SEC=2   # Combat turn submissions per second
```

## Tick-Based Combat System (v1.2)

```bash
# Core tick configuration
COMBAT_TICK_MS=2000                 # Tick interval (ms) - how often combat state advances
COMBAT_AUTOSWING_MS=2000            # Autoswing interval (ms)
COMBAT_ROUNDTIME_MS=2000            # Default roundtime (ms)
COMBAT_ROUNDTIME_MS_ATTACK=2000     # Roundtime after attack (ms)

# Worker configuration
COMBAT_TICK_POLL_MS=250             # How often worker checks for due instances (ms)
COMBAT_MAX_CATCHUP_TICKS=3          # Max ticks to process on catch-up (prevents overload)
REDLOCK_TTL_MS=5000                 # Redis lock TTL for distributed coordination (ms)
```

**Recommendations**:
- Keep `COMBAT_TICK_MS` >= 1000ms for stability
- Set `REDLOCK_TTL_MS` >= 2 * `COMBAT_TICK_MS`
- `COMBAT_MAX_CATCHUP_TICKS=3` balances catch-up vs stability

## Legacy Turn-Based Combat (deprecated)

```bash
TURN_SEC_FAST=3
TURN_SEC_TACTICAL=9
TIMEBANK_ADD_SEC=6
TIMEBANK_PER_ENCOUNTER=1
```

## Season Policy

```bash
MAX_UNLOCKED_SEASON=1       # Max unlocked season (1 = S1 only)
TEST_MODE=false             # If true, all seasons unlocked (99)
```

## Production Overrides

For production deployment, override in `docker-compose.yml` or environment:

```yaml
environment:
  NODE_ENV: production
  JWT_SECRET: ${JWT_SECRET}  # Use secure secrets
  ADMIN_KEY: ${ADMIN_KEY}
  MAX_UNLOCKED_SEASON: 1     # Lock to current season
  TEST_MODE: false
  COMBAT_TICK_MS: 2000
  COMBAT_MAX_CATCHUP_TICKS: 3
```

## Troubleshooting

### Ticks feel slower than 2s
- Check server logs for drift warnings
- Increase `COMBAT_TICK_POLL_MS` to 500ms
- Increase `REDLOCK_TTL_MS` to 10000ms

### Combat not processing
- Verify Redis is running
- Check `REDIS_URL` is correct
- Ensure `COMBAT_TICK_POLL_MS` is not too high

### Database connection issues
- Verify PostgreSQL is running
- Check `DATABASE_URL` port and credentials
- Run `pnpm db:wait` to test connection

