import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseTemplate() {
  console.log('🔍 从数据库查询模板信息\n');
  
  const templates = await prisma.actionTemplate.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' }
  });

  console.log('📋 数据库中的模板：\n');
  
  for (const template of templates) {
    console.log(`模板ID: ${template.id}`);
    console.log(`名称: ${template.name}`);
    console.log(`模式: ${template.mode}`);
    console.log(`提示词前200字符:`);
    console.log(template.promptTemplate.substring(0, 200));
    console.log(`参考图: ${template.referenceImagesJson}`);
    console.log('\n' + '-'.repeat(80) + '\n');
  }
}

diagnoseTemplate()
  .then(() => {
    console.log('\n✅ 查询完成');
    process.exit(0);
  })
  .catch(e => {
    console.error('\n❌ 查询失败:', e);
    process.exit(1);
  });
