const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplate() {
  const templateId = process.argv[2];
  
  if (!templateId) {
    console.log('请提供模板ID');
    console.log('用法: node check-template.js <templateId>');
    return;
  }

  const template = await prisma.actionTemplate.findUnique({
    where: { id: templateId }
  });
  
  if (template) {
    console.log('=== 模板信息 ===');
    console.log('ID:', template.id);
    console.log('名称:', template.name);
    console.log('模式:', template.mode);
    console.log('提示词模板:', template.promptTemplate);
    console.log('参考图JSON:', template.referenceImagesJson);
    console.log('预设参考图:');
    try {
      const refImages = JSON.parse(template.referenceImagesJson);
      if (Array.isArray(refImages) && refImages.length > 0) {
        refImages.forEach((img, idx) => {
          console.log(`  ${idx + 1}. ${img.name} - ${img.url}`);
        });
      } else {
        console.log('  (无)');
      }
    } catch (e) {
      console.log('  (解析失败)');
    }
  } else {
    console.log('模板不存在');
  }
  
  await prisma.$disconnect();
}

checkTemplate();
