import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migrateAdminPassword() {
  console.log('开始迁移 admin 密码到 bcrypt...\n');

  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!admin) {
    console.error('❌ 未找到 admin 用户');
    process.exit(1);
  }

  console.log(`找到 admin 用户: ${admin.username}`);
  console.log(`当前密码格式: ${admin.password.substring(0, 20)}...`);

  const isAlreadyBcrypt = admin.password.startsWith('$2');
  if (isAlreadyBcrypt) {
    console.log('✅ admin 密码已经是 bcrypt 格式，跳过');
    return;
  }

  const legacyPassword = 'Himice2024';
  const legacyHash = Buffer.from(legacyPassword).toString('base64');

  if (admin.password !== legacyHash) {
    console.error(`❌ 密码验证失败`);
    console.error(`期望: ${legacyHash}`);
    console.error(`实际: ${admin.password}`);
    process.exit(1);
  }

  console.log('✓ Base64 密码验证通过');
  console.log('正在生成 bcrypt 哈希...');

  const newHash = await bcrypt.hash(legacyPassword, 12);

  await prisma.user.update({
    where: { id: admin.id },
    data: { password: newHash },
  });

  console.log('✅ admin 密码已迁移到 bcrypt');
  console.log(`新哈希: ${newHash.substring(0, 30)}...`);
}

migrateAdminPassword()
  .then(() => {
    console.log('\n迁移完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移失败:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
