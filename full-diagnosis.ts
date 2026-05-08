import fs from 'node:fs';
import https from 'node:https';
import { Buffer } from 'node:buffer';

const API_KEY = 'sk-nN3PuvBju1rD1p9Cj2WSLFR8KcOcKEnU87pP1HKwpU83ydwW';

async function fullDiagnosis() {
  console.log('🔍 完整诊断报告\n');
  console.log('=' .repeat(80) + '\n');

  // 1. 检查模板提示词
  console.log('📋 1. 模板提示词检查');
  console.log('-'.repeat(80));
  
  const promptTemplate = `请将参考图1的画面应用到参考图2的模板样式中：\n\n要求：\n1. 保持参考图2的整体结构和布局\n2. 参考图1中的主要视觉元素应该清晰可见\n3. 颜色风格应该与参考图1保持一致\n4. 参考图2中的文字位置和大小保持不变\n5. 整体比例协调，美观大方`;
  
  console.log('❌ 模板中的提示词（应该包含实际的换行符）：');
  console.log(promptTemplate);
  console.log('\n');
  
  console.log('🔍 检查是否包含字面量 \\n：');
  const hasLiteralN = promptTemplate.includes('\\n');
  console.log(`   包含字面量 \\\\n: ${hasLiteralN ? '❌ 是' : '✅ 否'}`);
  console.log('\n');

  // 2. 检查上传的图片
  console.log('📋 2. 上传的图片检查');
  console.log('-'.repeat(80));
  
  const uploadsDir = 'public/storage/uploads';
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  const latestFile = files.sort().pop();
  
  if (latestFile) {
    const filePath = `${uploadsDir}/${latestFile}`;
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`📁 最新上传文件: ${latestFile}`);
    console.log(`📏 文件大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 检查PNG头
    const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
    const isPng = fileBuffer.slice(0, 8).equals(Buffer.from(pngHeader));
    console.log(`✅ PNG头正确: ${isPng ? '是' : '否'}`);
    
    console.log('\n');
  } else {
    console.log('❌ 没有找到上传的文件\n');
  }

  // 3. 模拟API调用
  console.log('📋 3. API调用参数');
  console.log('-'.repeat(80));
  
  const requestBody = {
    model: 'gpt-image-2',
    prompt: promptTemplate,
    size: '1024x1024',
    quality: 'medium',
    response_format: 'b64_json'
  };
  
  console.log('发送的请求体：');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n');

  // 4. 实际调用API
  console.log('📋 4. API调用结果');
  console.log('-'.repeat(80));
  
  return new Promise((resolve) => {
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
      console.log(`📡 HTTP状态码: ${res.statusCode}`);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (response.data && response.data[0]) {
            const imgData = response.data[0];
            console.log('\n✅ API返回数据:');
            console.log(`   - revised_prompt: ${imgData.revised_prompt || '无'}`);
            console.log(`   - b64_json长度: ${imgData.b64_json ? imgData.b64_json.length : 0}`);
            
            if (imgData.b64_json) {
              // 检查b64是否包含Data URL前缀
              const hasPrefix = imgData.b64_json.includes('data:');
              console.log(`   - 包含Data URL前缀: ${hasPrefix ? '❌ 是' : '✅ 否'}`);
              
              // 检查Base64是否有效
              let b64Data = imgData.b64_json;
              if (hasPrefix) {
                b64Data = b64Data.split(',')[1];
              }
              
              try {
                const decoded = Buffer.from(b64Data, 'base64');
                console.log(`   - Base64解码成功: ✅ 是`);
                console.log(`   - 解码后大小: ${(decoded.length / 1024 / 1024).toFixed(2)} MB`);
                
                // 检查PNG头
                const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
                const isPng = decoded.slice(0, 8).equals(Buffer.from(pngHeader));
                console.log(`   - PNG头正确: ${isPng ? '✅ 是' : '❌ 否'}`);
                
                if (isPng) {
                  // 保存测试图片
                  const outputPath = 'public/storage/outputs/diagnosis_result.png';
                  fs.writeFileSync(outputPath, decoded);
                  console.log(`\n💾 测试图片已保存: ${outputPath}`);
                }
              } catch (e: any) {
                console.log(`   - Base64解码失败: ❌ ${e.message}`);
              }
            }
          } else {
            console.log('❌ 没有收到图片数据');
            console.log('响应:', JSON.stringify(response, null, 2).substring(0, 500));
          }
        } catch (e: any) {
          console.log(`❌ JSON解析失败: ${e.message}`);
          console.log('原始响应:', body.substring(0, 500));
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('🎯 结论和建议');
        console.log('='.repeat(80));
        
        if (hasLiteralN) {
          console.log('❌ 提示词包含字面量 \\n，应该使用实际的换行符');
          console.log('   修复方法：在模板中使用实际的换行符，而不是 \\n');
        }
        
        resolve(undefined);
      });
    });

    req.on('error', (e) => {
      console.log(`❌ 请求失败: ${e.message}`);
      resolve(undefined);
    });

    req.write(data);
    req.end();
  });
}

fullDiagnosis()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ 诊断失败:', e);
    process.exit(1);
  });
