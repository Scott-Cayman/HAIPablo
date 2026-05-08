import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testProjectAPI() {
  console.log('🧪 测试项目 API...\n');

  // 测试创建项目
  console.log('1. 创建测试项目...');
  const project = await prisma.project.create({
    data: {
      name: '测试项目',
      description: '这是一个测试项目',
      clientName: '测试客户',
      eventName: '测试活动',
      city: '北京',
      brandName: '测试品牌',
      status: 'active'
    }
  });
  console.log('✅ 项目创建成功:', project.id);

  // 测试获取项目列表
  console.log('\n2. 获取项目列表...');
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(`✅ 找到 ${projects.length} 个项目`);

  // 测试获取功能组
  console.log('\n3. 获取功能组...');
  const featureGroups = await prisma.featureGroup.findMany({
    include: {
      templates: {
        where: { enabled: true }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });
  console.log(`✅ 找到 ${featureGroups.length} 个功能组`);
  featureGroups.forEach(group => {
    console.log(`  - ${group.name}: ${group.templates.length} 个模板`);
  });

  // 测试获取模板
  console.log('\n4. 获取模板详情...');
  const templates = await prisma.actionTemplate.findMany({
    where: { enabled: true },
    take: 2
  });

  if (templates.length > 0) {
    const template = templates[0];
    console.log(`✅ 找到模板: ${template.name}`);
    console.log('   模式:', template.mode);
    console.log('   默认尺寸:', template.defaultSize);
    console.log('   默认质量:', template.defaultQuality);
    
    const inputSlots = JSON.parse(template.inputSlotsJson);
    console.log('   输入槽位:', inputSlots.length);
    
    const variables = JSON.parse(template.variablesJson);
    console.log('   变量:', variables.map((v: any) => v.label).join(', '));
  }

  // 清理测试数据
  console.log('\n5. 清理测试数据...');
  await prisma.project.delete({
    where: { id: project.id }
  });
  console.log('✅ 测试数据已清理');

  console.log('\n✅ 所有 API 测试通过！');
}

async function main() {
  try {
    await testProjectAPI();
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
