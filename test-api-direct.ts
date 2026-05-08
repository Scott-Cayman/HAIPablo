import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const API_KEY = 'sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW';
const API_URL = 'https://api.jyf.ai/v1/images/generations';

async function generateImage() {
  console.log('🎨 开始生成图片...\n');

  const requestBody = {
    model: 'gpt-image-2',
    prompt: '一只可爱的小猫，摄影风格，高清',
    size: '1024x1024',
    quality: 'medium',
    response_format: 'b64_json'
  };

  console.log('📝 请求参数：');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n');

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(requestBody);
    
    const options = {
      hostname: 'api.jyf.ai',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      console.log(`📡 响应状态码: ${res.statusCode}`);
      
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log('\n📦 响应内容：');
        try {
          const response = JSON.parse(body);
          console.log(JSON.stringify(response, null, 2));
          
          if (response.data && response.data[0] && response.data[0].b64_json) {
            console.log('\n✅ 图片生成成功！');
            
            const imageBuffer = Buffer.from(response.data[0].b64_json, 'base64');
            
            const outputPath = path.join(process.cwd(), 'public', 'storage', 'outputs', 'test_kitten.png');
            
            fs.writeFileSync(outputPath, imageBuffer);
            
            console.log(`💾 图片已保存到: ${outputPath}`);
            console.log(`📏 图片大小: ${imageBuffer.length} bytes`);
            
            resolve(outputPath);
          } else {
            console.log('\n❌ 图片生成失败：没有收到图片数据');
            reject(new Error('没有收到图片数据'));
          }
        } catch (error) {
          console.log('\n❌ 解析响应失败：');
          console.log(body);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ 请求失败：', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

generateImage()
  .then(() => {
    console.log('\n🎉 测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败：', error);
    process.exit(1);
  });
