import fs from 'node:fs';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const API_KEY = 'sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW';
const API_URL = 'https://api.jyf.ai';

async function diagnoseGeneration() {
  console.log('🔍 诊断生成任务...\n');

  // 模拟上一次生成任务的参数
  const template = {
    id: 'cmokt3qok0005fqg85afpb5le',
    name: '签到板生成',
    promptTemplate: `请将参考图1的画面应用到参考图2的模板样式中：\n\n要求：\n1. 保持参考图2的整体结构和布局\n2. 参考图1中的主要视觉元素应该清晰可见\n3. 颜色风格应该与参考图1保持一致\n4. 参考图2中的文字位置和大小保持不变\n5. 整体比例协调，美观大方`
  };

  console.log('📋 模板信息：');
  console.log(JSON.stringify(template, null, 2));
  console.log('\n');

  // 检查用户上传的图片
  const uploadsDir = 'public/storage/uploads';
  const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  
  console.log('📁 上传目录文件列表：');
  console.log(uploadedFiles);
  console.log('\n');

  if (uploadedFiles.length > 0) {
    const latestFile = uploadedFiles.sort().pop();
    console.log('🔍 最新上传的文件:', latestFile);
    
    const filePath = `${uploadsDir}/${latestFile}`;
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`\n📏 文件大小: ${fileBuffer.length} bytes`);
    
    // 检查文件类型
    const header = fileBuffer.slice(0, 8);
    console.log('🔍 文件头: ', Array.from(header).join(', '));
    
    // PNG头应该是 89 50 4E 47
    const isPng = [137, 80, 78, 71, 13, 10, 26, 10];
    const isPngValid = header.equals(Buffer.from(isPng));
    console.log(`✅ PNG头正确: ${isPngValid ? '是' : '否'}`);
    
    // 检查Base64编码
    const base64 = fileBuffer.toString('base64');
    console.log(`📏 Base64长度: ${base64.length}`);
    console.log(`📏 Base64前100字符: ${base64.substring(0, 100)}...`);
    
    // 检查是否有Data URL前缀
    const decoded = Buffer.from(base64, 'base64');
    console.log(`\n🔍 解码后大小: ${decoded.length} bytes`);
    console.log(`🔍 解码后文件头: ${Array.from(decoded.slice(0, 8)).join(', ')}`);
    
    console.log('\n💾 保存为测试文件...');
    fs.writeFileSync('public/storage/outputs/diagnose_test.png', decoded);
    console.log('✅ 诊断测试文件已保存');
  }
}

diagnoseGeneration()
  .then(() => {
    console.log('\n🎉 诊断完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 诊断失败:', error);
    process.exit(1);
  });
