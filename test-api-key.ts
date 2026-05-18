import https from 'node:https';
import { Buffer } from 'node:buffer';

const API_KEY = process.env.GPT_IMAGE_API_KEY || 'sk-SEcOG79S2wWiMSJa2M0B6CMPF9oADawN22VgZ3dhpdN2h5Sf';

async function testImageGeneration() {
  console.log('🧪 开始测试图片生成 API...\n');
  console.log('📍 API URL:', 'https://api.jyf.ai/v1/images/generations');
  console.log('🔑 API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : '未设置', '\n');

  if (!API_KEY) {
    console.error('❌ 错误: 缺少 API Key');
    process.exit(1);
  }

  const requestBody = {
    model: 'gpt-image-2',
    prompt: '一只可爱的橘猫，摄影风格，高清',
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
          const json = JSON.parse(body);
          console.log(JSON.stringify(json, null, 2));

          if (res.statusCode === 200) {
            console.log('\n✅ 测试成功！');
          } else {
            console.log('\n❌ 测试失败！');
          }
        } catch (e) {
          console.log(body);
          console.log('\n❌ JSON 解析失败');
        }
        resolve(body);
      });
    });

    req.on('error', (e) => {
      console.error(`\n❌ 请求错误: ${e.message}`);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

testImageGeneration().catch(console.error);
