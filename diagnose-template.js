const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseTemplate() {
  const templateId = process.argv[2];
  
  if (!templateId) {
    console.log('用法: node diagnose-template.js <templateId>');
    return;
  }

  console.log('=== 诊断模板配置 ===\n');

  const template = await prisma.actionTemplate.findUnique({
    where: { id: templateId }
  });
  
  if (!template) {
    console.log('❌ 模板不存在');
    return;
  }

  console.log('基本信息:');
  console.log('  ID:', template.id);
  console.log('  名称:', template.name);
  console.log('  模式:', template.mode);
  console.log('  启用:', template.enabled ? '✓' : '✗');

  console.log('\n提示词模板:');
  console.log('  ', template.promptTemplate || '(空)');

  console.log('\n预设参考图:');
  try {
    const refImages = JSON.parse(template.referenceImagesJson);
    if (Array.isArray(refImages) && refImages.length > 0) {
      refImages.forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img.name}`);
        console.log(`     URL: ${img.url}`);
        console.log(`     ID: ${img.id}`);
      });
      console.log(`  总计: ${refImages.length} 张`);
    } else {
      console.log('  (无预设参考图)');
    }
  } catch (e) {
    console.log('  (解析失败)');
  }

  console.log('\n生成参数:');
  console.log('  默认尺寸:', template.defaultSize);
  console.log('  默认质量:', template.defaultQuality);

  console.log('\n⚠️  潜在问题检查:');
  
  // 检查提示词是否包含"参考图1"和"参考图2"
  const prompt = template.promptTemplate || '';
  const hasRef1 = prompt.includes('参考图1');
  const hasRef2 = prompt.includes('参考图2');
  
  if (!hasRef1 && !hasRef2) {
    console.log('  ❌ 提示词中未找到"参考图1"或"参考图2"引用');
  } else if (hasRef1 && hasRef2) {
    console.log('  ✓ 提示词包含参考图1和参考图2引用');
  } else if (hasRef1) {
    console.log('  ⚠️  提示词只包含参考图1，建议也包含参考图2');
  } else if (hasRef2) {
    console.log('  ⚠️  提示词只包含参考图2，建议也包含参考图1');
  }

  // 检查模式设置
  if (template.mode === 'edit') {
    try {
      const refImages = JSON.parse(template.referenceImagesJson);
      if (refImages.length === 0) {
        console.log('  ⚠️  模式设置为"edit"但没有预设参考图');
      }
    } catch (e) {
      console.log('  ⚠️  模式设置为"edit"但预设参考图配置无效');
    }
  }

  // 检查提示词是否有明显的逻辑错误
  const selfRefPattern = /参考图[12].*参考图[12]/g;
  const matches = prompt.match(selfRefPattern);
  if (matches && matches.length > 0) {
    console.log('  ❌ 提示词可能存在自引用问题:');
    matches.forEach(match => {
      console.log('     ', match);
    });
  }

  await prisma.$disconnect();
  
  console.log('\n=== 诊断完成 ===');
}

diagnoseTemplate();
