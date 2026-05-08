const fs = require('fs');
const path = require('path');

console.log('=== 图片文件诊断工具 ===\n');

const testUrls = [
  '/storage/uploads/1778055843545_bnmfaspu1.png',  // 预设参考图1
  '/storage/uploads/1778055845845_i96bta31b.png',  // 预设参考图2
];

console.log('检查图片文件是否存在...\n');

testUrls.forEach((url, index) => {
  const filePath = path.join(process.cwd(), 'public', url);
  const exists = fs.existsSync(filePath);
  
  console.log(`图片 ${index + 1}: ${url}`);
  console.log(`  完整路径: ${filePath}`);
  console.log(`  存在: ${exists ? '✓ 是' : '✗ 否'}`);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`  大小: ${(stats.size / 1024).toFixed(2)} KB`);
  }
  
  console.log('');
});

console.log('=== 诊断完成 ===');
console.log('\n💡 提示: 如果图片不存在，可能是上传失败或文件被删除');
