import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

async function main() {
  console.log('开始创建管理员账号...');

  try {
    // 创建管理员账号
    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: { role: 'admin' },
      create: {
        username: 'admin',
        password: hashPassword('Himice2024'),
        name: '管理员',
        email: 'admin@example.com',
        role: 'admin'
      }
    });

    console.log('✅ 管理员账号创建成功！');
    console.log('   用户名: admin');
    console.log('   密码: Himice2024');
    console.log('   昵称: 管理员');
  } catch (error) {
    console.error('❌ 创建管理员账号失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
