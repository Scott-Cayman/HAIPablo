import https from 'node:https';
import fs from 'node:fs';
import { Buffer } from 'node:buffer';

const API_KEY = process.env.GPT_IMAGE_API_KEY || 'sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW';
const API_URL = 'api.jyf.ai';
const UPLOADS_DIR = 'public/storage/uploads';
const OUTPUTS_DIR = 'public/storage/outputs';

async function testGeneration() {
  console.log('🔍 开始诊断图片生成问题...\n');

  // 1. 检查上传目录
  console.log('📁 检查上传目录...');
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('❌ 上传目录不存在');
    return;
  }

  const uploadedFiles = fs.readdirSync(UPLOADS_DIR)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
  
  console.log(`✅ 上传目录存在，找到 ${uploadedFiles.length} 个文件`);
  
  if (uploadedFiles.length === 0) {
    console.log('❌ 没有找到任何上传的图片');
    return;
  }

  // 2. 获取最新的文件
  uploadedFiles.sort();
  const latestFile = uploadedFiles[uploadedFiles.length - 1];
  const filePath = `${UPLOADS_DIR}/${latestFile}`;
  
  console.log(`\n📄 测试文件: ${latestFile}`);
  const fileBuffer = fs.readFileSync(filePath);
  console.log(`📏 文件大小: ${fileBuffer.length} bytes`);

  // 3. 检查文件格式
  const header = fileBuffer.slice(0, 8);
  const isPng = [137, 80, 78, 71, 13, 10, 26, 10];
  const isJpeg = [255, 216, 255, 224];

  const isPngValid = header.equals(Buffer.from(isPng));
  const isJpegValid = header.slice(0, 3).equals(Buffer.from(isJpeg.slice(0, 3)));
  
  console.log(`🔍 PNG头验证: ${isPngValid ? '✓' : '✗'}`);
  console.log(`🔍 JPEG头验证: ${isJpegValid ? '✓' : '✗'}`);

  // 4. 准备测试
  const testPrompt = '一个简单的测试图片，保持原始图片的基本特征';

  // 5. 测试生成API
  console.log('\n🔄 测试生成模式...');
  await testApiCall(testPrompt, null, 'generate');

  // 6. 测试编辑模式（如果有足够文件）
  if (uploadedFiles.length >= 1) {
    console.log('\n🔄 测试编辑模式...');
    const base64Image = fileBuffer.toString('base64');
    await testApiCall(testPrompt, base64Image, 'edit');
  }
}

async function testApiCall(prompt: string, imageBase64: string | null, mode: 'generate' | 'edit') {
  return new Promise((resolve) => {
    const body: any = {
      model: 'gpt-image-2',
      prompt: prompt,
      size: '1024x1024',
      quality: 'medium',
      response_format: 'b64_json'
    };

    if (mode === 'edit' && imageBase64) {
      body.image = `data:image/png;base64,${imageBase64}`;
    }

    const bodyString = JSON.stringify(body);

    const options = {
      hostname: API_URL,
      port: 443,
      path: mode === 'generate' ? '/v1/images/generations' : '/v1/images/edits',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString)
      }
    };

    console.log(`📤 发送请求到 ${options.path}...`);
    console.log(`📝 提示词: ${prompt.substring(0, 50)}...`);
    if (imageBase64) {
      console.log(`🖼️  图片大小: ${imageBase64.length} bytes (base64)`);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📥 响应状态: ${res.statusCode}`);

        try {
          const jsonData = JSON.parse(data);
          
          if (res.statusCode === 200 && jsonData.data && jsonData.data[0]) {
            console.log('✅ 生成成功!');
            const b64Data = jsonData.data[0].b64_json;
            
            // 保存测试图片
            if (!fs.existsSync(OUTPUTS_DIR)) {
              fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
            }
            
            const outputPath = `${OUTPUTS_DIR}/test_${mode}_${Date.now()}.png`;
            const imageBuffer = Buffer.from(b64Data, 'base64');
            fs.writeFileSync(outputPath, imageBuffer);
            console.log(`💾 测试图片已保存: ${outputPath}`);
          } else {
            console.log('❌ 生成失败');
            console.log('📄 响应内容:', JSON.stringify(jsonData, null, 2));
          }
        } catch (e: any) {
          console.log('❌ 解析响应失败');
          console.log('📄 原始响应:', data.substring(0, 500));
          console.log('🔍 错误:', e.message);
        }

        console.log('');
        resolve(null);
      });
    });

    req.on('error', (e) => {
      console.log(`❌ 请求失败: ${e.message}`);
      console.log('');
      resolve(null);
    });

    req.write(bodyString);
    req.end();
  });
}

// 运行诊断
testGeneration()
  .then(() => {
    console.log('🏁 诊断完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 诊断过程出错:', error);
    process.exit(1);
  });
