## SQLite Legacy Backup

This folder stores SQLite-era leftovers that have been moved out of the active project path after the app switched to PostgreSQL.

Archived items:
- `query-db.ts`: old SQLite inspection script targeting `prisma/dev.db`
- `better-sqlite3.d.ts`: old local type shim for `better-sqlite3`

Intentionally not moved:
- `prisma/migrations/migration_lock.toml`
  - This still says `sqlite`, but it is part of the unfinished Prisma migration history cleanup and should not be removed casually.

Archived on:
- `2026-05-25`
