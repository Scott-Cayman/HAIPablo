import { prisma } from './lib/prisma';

async function checkHistory() {
  try {
    // 获取最近的历史记录，按时间倒序
    const histories = await prisma.generationHistory.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            name: true
          }
        }
      }
    });

    console.log('=== 最近生成历史 ===\n');

    const successCount = histories.filter(h => h.status === 'success').length;
    const failedCount = histories.filter(h => h.status === 'failed').length;
    const processingCount = histories.filter(h => h.status === 'processing').length;

    console.log(`总计: ${histories.length} 条`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failedCount}`);
    console.log(`处理中: ${processingCount}`);
    console.log('');

    // 显示失败的记录
    const failedHistories = histories.filter(h => h.status === 'failed');
    if (failedHistories.length > 0) {
      console.log('=== 失败的记录 ===\n');
      for (const history of failedHistories) {
        console.log(`ID: ${history.id}`);
        console.log(`模板: ${history.templateName}`);
        console.log(`用户: ${history.user.username} (${history.user.name})`);
        console.log(`时间: ${history.createdAt}`);
        console.log(`提示词: ${history.prompt.substring(0, 100)}...`);
        console.log('---');
      }
    }

    // 按时间分组显示
    console.log('\n=== 按时间顺序（最近20条）===\n');
    const recent = histories.slice(0, 20);
    for (const h of recent) {
      const statusIcon = h.status === 'success' ? '✓' : h.status === 'failed' ? '✗' : '⟳';
      const statusColor = h.status === 'success' ? '\x1b[32m' : h.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
      console.log(`${statusColor}${statusIcon}\x1b[0m ${h.templateName} - ${h.user.username} - ${new Date(h.createdAt).toLocaleString('zh-CN')}`);
    }

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHistory();
