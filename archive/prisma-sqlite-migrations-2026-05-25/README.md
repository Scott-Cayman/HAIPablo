## Prisma SQLite Migration Archive

This folder stores the old SQLite-era Prisma migrations after the project was re-baselined to PostgreSQL.

Active migrations now live in:
- `prisma/migrations/20260525103000_pg_baseline`

Why these files were archived:
- They belonged to the pre-PostgreSQL migration history.
- Keeping them in the active Prisma migrations path would continue to mislead tooling.

Archived on:
- `2026-05-25`
