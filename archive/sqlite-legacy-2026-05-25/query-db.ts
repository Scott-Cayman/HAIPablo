import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

async function checkDatabase() {
  try {
    if (!fs.existsSync(dbPath)) {
      console.log('❌ 数据库文件不存在:', dbPath);
      return;
    }

    console.log('🔍 正在连接数据库...\n');

    const db = new Database(dbPath, { readonly: true });

    const failedHistories = db.prepare(`
      SELECT
        h.id,
        h.templateName,
        h.prompt,
        h.status,
        h.creditsUsed,
        h.createdAt,
        u.username,
        u.name
      FROM GenerationHistory h
      LEFT JOIN User u ON h.userId = u.id
      WHERE h.status = 'failed'
      ORDER BY h.createdAt DESC
      LIMIT 20
    `).all();

    console.log(`📊 找到 ${failedHistories.length} 条失败记录\n`);

    if (failedHistories.length > 0) {
      console.log('=== 失败记录详情 ===\n');
      for (const history of failedHistories) {
        console.log(`模板: ${history.templateName}`);
        console.log(`用户: ${history.username} (${history.name})`);
        console.log(`时间: ${new Date(history.createdAt).toLocaleString('zh-CN')}`);
        console.log(`提示词: ${(history.prompt as string).substring(0, 100)}...`);
        console.log('---');
      }
    }

    const successHistories = db.prepare(`
      SELECT
        h.id,
        h.templateName,
        h.status,
        h.creditsUsed,
        h.createdAt,
        u.username
      FROM GenerationHistory h
      LEFT JOIN User u ON h.userId = u.id
      WHERE h.status = 'success'
      ORDER BY h.createdAt DESC
      LIMIT 20
    `).all();

    console.log(`\n📊 成功记录 (最近20条)\n`);
    for (const history of successHistories) {
      console.log(`✓ ${history.templateName} - ${history.username} - ${new Date(history.createdAt).toLocaleString('zh-CN')}`);
    }

    const stats = db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(creditsUsed) as totalCredits
      FROM GenerationHistory
      GROUP BY status
    `).all();

    console.log('\n📈 统计信息:');
    for (const stat of stats as any[]) {
      console.log(`${stat.status}: ${stat.count} 条, 消耗算力: ${stat.totalCredits || 0}`);
    }

    db.close();
    console.log('\n✅ 查询完成');
  } catch (error: any) {
    console.error('❌ 查询失败:', error.message);
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('\n💡 提示: 需要安装 better-sqlite3');
      console.log('   运行: npm install better-sqlite3');
    }
  }
}

checkDatabase();
