import fs from 'node:fs';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const API_KEY = 'sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW';

async function testBase64() {
  console.log('🧪 测试Base64解码...\n');

  const requestBody = {
    model: 'gpt-image-2',
    prompt: '一只可爱的小猫',
    size: '1024x1024',
    quality: 'medium',
    response_format: 'b64_json'
  };

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
        try {
          const response = JSON.parse(body);
          console.log('\n✅ JSON解析成功');
          
          if (response.data && response.data[0] && response.data[0].b64_json) {
            const b64 = response.data[0].b64_json;
            console.log(`\n📏 Base64字符串长度: ${b64.length}`);
            console.log(`📏 前100个字符: ${b64.substring(0, 100)}...`);
            
            console.log('\n🔍 检查Base64字符串特征：');
            console.log(`  - 是否包含非Base64字符: ${/^[A-Za-z0-9+/=]+$/.test(b64) ? '❌ 包含非Base64字符' : '✅ 纯Base64字符'}`);
            console.log(`  - 长度是否为4的倍数: ${b64.length % 4 === 0 ? '✅ 是' : '❌ 否'}`);
            console.log(`  - 末尾padding: ${b64.substring(b64.length - 4)}`);
            
            try {
              const imageBuffer = Buffer.from(b64, 'base64');
              console.log(`\n✅ Base64解码成功`);
              console.log(`📏 解码后大小: ${imageBuffer.length} bytes`);
              
              // 检查PNG文件头
              if (imageBuffer.length > 8) {
                const header = imageBuffer.slice(0, 8);
                const signature = [137, 80, 78, 71, 13, 10, 26, 10];
                const isPng = header.equals(Buffer.from(signature));
                console.log(`\n🔍 PNG文件头检查:`);
                console.log(`  - 期望: ${signature.join(',')}`);
                console.log(`  - 实际: ${Array.from(header).join(',')}`);
                console.log(`  - ${isPng ? '✅ PNG文件头正确' : '❌ PNG文件头错误'}`);
                
                if (!isPng) {
                  // 检查是否是其他格式
                  const jpgSignature = [255, 216, 255];
                  const isJpg = imageBuffer.slice(0, 3).equals(Buffer.from(jpgSignature));
                  console.log(`  - 是否为JPEG: ${isJpg ? '✅ 是' : '❌ 否'}`);
                }
              }
              
              const outputPath = 'public/storage/outputs/test_base64.png';
              fs.writeFileSync(outputPath, imageBuffer);
              console.log(`\n💾 图片已保存: ${outputPath}`);
              
              resolve(imageBuffer);
            } catch (decodeError) {
              console.error('\n❌ Base64解码失败:', decodeError);
              reject(decodeError);
            }
          } else {
            console.log('\n❌ 没有收到b64_json数据');
            console.log('响应内容:', JSON.stringify(response, null, 2).substring(0, 500));
            reject(new Error('没有收到图片数据'));
          }
        } catch (error) {
          console.error('\n❌ JSON解析失败:', error);
          console.log('原始响应:', body.substring(0, 500));
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ 请求失败:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

testBase64()
  .then(() => {
    console.log('\n🎉 测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  });
