import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据...');

  // 清理现有数据
  await prisma.generationJobItem.deleteMany();
  await prisma.generationJob.deleteMany();
  await prisma.actionTemplate.deleteMany();
  await prisma.featureGroup.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.project.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 创建功能组
  const materialGroup = await prisma.featureGroup.create({
    data: {
      name: '物料延展生成',
      key: 'material_extension',
      description: '基于主视觉 KV 自动延展生成活动执行物料',
      icon: 'Layers',
      sortOrder: 1,
      enabled: true
    }
  });

  const posterGroup = await prisma.featureGroup.create({
    data: {
      name: '海报智能生成',
      key: 'poster_generation',
      description: '根据活动信息和参考风格生成传播海报',
      icon: 'Palette',
      sortOrder: 2,
      enabled: true
    }
  });

  const productGroup = await prisma.featureGroup.create({
    data: {
      name: '产品视觉生成',
      key: 'product_visual',
      description: '根据产品图和品牌调性生成商业产品海报',
      icon: 'Image',
      sortOrder: 3,
      enabled: true
    }
  });

  const portraitGroup = await prisma.featureGroup.create({
    data: {
      name: '人像形象照生成',
      key: 'portrait_generation',
      description: '根据人物照片生成商务形象照和不同风格头像',
      icon: 'User',
      sortOrder: 4,
      enabled: true
    }
  });

  // 创建物料延展生成模板
  await prisma.actionTemplate.create({
    data: {
      featureGroupId: materialGroup.id,
      name: '签到板生成',
      key: 'sign_board_' + Date.now(),
      description: '基于主视觉生成活动签到板',
      mode: 'edit',
      promptTemplate: '请将参考图1的画面应用到参考图2的模板样式中：\n\n要求：\n1. 保持参考图2的整体结构和布局\n2. 参考图1中的主要视觉元素应该清晰可见\n3. 颜色风格应该与参考图1保持一致\n4. 参考图2中的文字位置和大小保持不变\n5. 整体比例协调，美观大方',
      negativePrompt: '',
      defaultSize: '1024x1024',
      defaultQuality: 'medium',
      responseFormat: 'b64_json',
      inputSlotsJson: JSON.stringify([]),
      variablesJson: JSON.stringify([]),
      referenceImagesJson: JSON.stringify([]),
      sortOrder: 1,
      enabled: true
    }
  });

  console.log('✅ 种子数据初始化完成！');
  console.log('   - 4个功能组已创建');
  console.log('   - 1个模板已创建');
}

main()
  .catch((e) => {
    console.error('初始化种子数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
