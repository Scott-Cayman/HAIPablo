import fs from 'node:fs/promises';
import path from 'node:path';

const BACKUP_PREFIX = 'haipablo-db-backup-';
const LATEST_BACKUP_FILE = 'haipablo-db-backup-latest.json';
const RETENTION_DAYS = 7;

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const raw = await fs.readFile(envPath, 'utf8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseDatabaseInfo(databaseUrl: string) {
  const url = new URL(databaseUrl);

  return {
    provider: url.protocol.replace(':', ''),
    host: url.hostname,
    port: url.port || '(default)',
    database: url.pathname.replace(/^\//, '')
  };
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function cleanupExpiredBackups(backupDir: string) {
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const expireBefore = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith(BACKUP_PREFIX) || !entry.name.endsWith('.json')) continue;
    if (entry.name === LATEST_BACKUP_FILE) continue;

    const filePath = path.join(backupDir, entry.name);
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < expireBefore) {
      await fs.unlink(filePath);
      deletedCount += 1;
    }
  }

  return deletedCount;
}

async function main() {
  await loadEnvFile();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL，无法执行备份');
  }

  const dbInfo = parseDatabaseInfo(databaseUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `${BACKUP_PREFIX}${timestamp}.json`);
  const latestBackupFile = path.join(backupDir, LATEST_BACKUP_FILE);
  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await fs.mkdir(backupDir, { recursive: true });
    await client.connect();

    console.log('开始备份数据库...');
    console.log(`连接目标: ${dbInfo.provider}://${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`);

    const currentDbResult = await client.query(
      'SELECT current_database(), current_user'
    );
    const currentDb = currentDbResult.rows[0] as {
      current_database: string;
      current_user: string;
    };

    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tableRows = tableResult.rows as Array<{ table_name: string }>;
    const tableNames = tableRows.map((row) => row.table_name);
    const tables: Record<string, unknown[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const tableName of tableNames) {
      const rowsResult = await client.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);
      tables[tableName] = rowsResult.rows;
      tableCounts[tableName] = rowsResult.rowCount || 0;
    }

    const actionTemplateColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ActionTemplate'
      ORDER BY ordinal_position ASC
    `);
    const actionTemplateColumnRows = actionTemplateColumnsResult.rows as Array<{ column_name: string }>;
    const actionTemplateColumns = actionTemplateColumnRows.map((row) => row.column_name);
    const migrationTableExists = tableNames.includes('_prisma_migrations');
    const migrationCount = migrationTableExists ? tableCounts._prisma_migrations || 0 : 0;

    const backupData = {
      meta: {
        createdAt: new Date().toISOString(),
        provider: dbInfo.provider,
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        currentDatabase: currentDb.current_database,
        currentUser: currentDb.current_user,
        retentionDays: RETENTION_DAYS,
        tableCounts,
        schemaCheck: {
          actionTemplateColumns,
          hasEnableReferenceBatchMode: actionTemplateColumns.includes('enableReferenceBatchMode'),
          hasEnableCustomReferenceUpload: actionTemplateColumns.includes('enableCustomReferenceUpload'),
          hasAllowMultipleCustomReferences: actionTemplateColumns.includes('allowMultipleCustomReferences'),
          hasPrismaMigrationsTable: migrationTableExists,
          prismaMigrationCount: migrationCount
        }
      },
      tables
    };

    const content = JSON.stringify(backupData, null, 2);
    await fs.writeFile(backupFile, content, 'utf8');
    await fs.writeFile(latestBackupFile, content, 'utf8');
    const deletedCount = await cleanupExpiredBackups(backupDir);

    console.log(`备份完成: ${backupFile}`);
    console.log(`最新备份: ${latestBackupFile}`);
    console.log(`公共表数量: ${tableNames.length}`);
    console.log(`ActionTemplate.enableCustomReferenceUpload: ${actionTemplateColumns.includes('enableCustomReferenceUpload') ? '存在' : '缺失'}`);
    console.log(`_prisma_migrations: ${migrationTableExists ? `存在 (${migrationCount} 条)` : '不存在'}`);
    console.log(`已清理过期备份: ${deletedCount} 个`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('数据库备份失败:');
  console.error(error);
  process.exit(1);
});
