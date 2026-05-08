import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplates() {
  const templates = await prisma.actionTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('最近的5个模板：\n');
  
  for (const template of templates) {
    console.log(`模板ID: ${template.id}`);
    console.log(`名称: ${template.name}`);
    console.log(`promptTemplate长度: ${template.promptTemplate?.length || 0}`);
    console.log(`promptTemplate内容: ${template.promptTemplate?.substring(0, 100) || '空'}`);
    console.log(`referenceImagesJson: ${template.referenceImagesJson}`);
    console.log('---');
  }
}

checkTemplates()
  .then(() => {
    console.log('\n查询完成');
    process.exit(0);
  })
  .catch(e => {
    console.error('查询失败:', e);
    process.exit(1);
  });
