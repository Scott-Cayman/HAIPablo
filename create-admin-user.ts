import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

async function createAdmin() {
  try {
    const hashedPassword = hashPassword('Himice2024');
    
    console.log('原始密码：Himice2024');
    console.log('哈希密码：', hashedPassword);

    // 先删除可能存在的admin用户
    await prisma.user.deleteMany({
      where: { username: 'admin' }
    });

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        name: '管理员',
        role: 'admin',
      }
    });

    console.log('✅ 管理员账号创建成功！');
    console.log('用户名：admin');
    console.log('密码：Himice2024');
    console.log('用户ID：', admin.id);

    // 验证密码
    const verifyHash = hashPassword('Himice2024');
    const testUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    console.log('验证密码匹配：', testUser?.password === verifyHash);
  } catch (error) {
    console.error('创建失败：', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
