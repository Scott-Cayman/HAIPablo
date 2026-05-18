import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const { authCode } = await request.json();
    if (!authCode) {
      return NextResponse.json({ error: 'Missing authCode' }, { status: 400 });
    }

    const clientId = process.env.DINGTALK_CLIENT_ID || 'your_client_id_here';
    const clientSecret = process.env.DINGTALK_CLIENT_SECRET || 'your_client_secret_here';

    // 1. Get user access token
    const tokenResponse = await fetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
        code: authCode,
        grantType: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.accessToken) {
      console.error('Failed to get DingTalk access token:', tokenData);
      return NextResponse.json({ error: 'Failed to authenticate with DingTalk' }, { status: 401 });
    }

    // 2. Get user info
    const userResponse = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
      method: 'GET',
      headers: {
        'x-acs-dingtalk-access-token': tokenData.accessToken,
        'Content-Type': 'application/json',
      },
    });

    const userData = await userResponse.json();
    console.log('DingTalk User Info Response:', JSON.stringify(userData, null, 2));
    
    if (!userResponse.ok || !userData.unionId) {
      console.error('Failed to get DingTalk user info:', userData);
      return NextResponse.json({ error: 'Failed to get user profile from DingTalk' }, { status: 401 });
    }

    let { unionId, openId, nick, avatarUrl, mobile, email, orgEmail, deptIdList } = userData;

    // 2.5 通过企业级 Token 获取用户绝对完整的个人信息（以防 v1.0/contact/users/me 不返回 org_email）
    try {
      // 获取企业 App Token
      const appTokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${clientId}&appsecret=${clientSecret}`);
      const appTokenData = await appTokenRes.json();
      const appAccessToken = appTokenData.access_token;

      if (appAccessToken && unionId) {
        // 先通过 unionid 获取 userid
        const uidRes = await fetch(`https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${appAccessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unionid: unionId })
        });
        const uidData = await uidRes.json();
        
        if (uidData.errcode === 0 && uidData.result) {
          const userid = uidData.result.userid;
          openId = userid; // 覆盖 openId 为内部 userid
          
          // 再通过 userid 调用 topapi/v2/user/get 获取完整信息
          const detailRes = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${appAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid })
          });
          const detailData = await detailRes.json();
          if (detailData.errcode === 0 && detailData.result) {
            console.log('DingTalk Detailed User Info (v2/user/get):', detailData.result);
            orgEmail = detailData.result.org_email || orgEmail;
            email = detailData.result.email || email;
            if (detailData.result.dept_id_list) {
              deptIdList = detailData.result.dept_id_list;
            }
          }
        }
      }
    } catch (fullInfoErr) {
      console.error('获取用户完整信息(v2/user/get)失败, 将使用基础信息:', fullInfoErr);
    }
    
    // 优先使用 orgEmail (企业邮箱)，如果没有则使用 email
    const userEmail = orgEmail || email;

    // 检查邮箱后缀限制
    if (!userEmail || !userEmail.endsWith('@himice.com')) {
      console.warn(`DingTalk user ${nick} (${unionId}) blocked: email is ${userEmail}`);
      return NextResponse.json({ 
        error: '登录失败：未获取到企业邮箱，或该邮箱不属于智海王潮传播集团（需为 @himice.com 结尾）。' 
      }, { status: 403 });
    }

    // Optional: Get or create department based on first deptId (if exists)
    let departmentId = null;
    console.log('DingTalk User Data deptIdList:', deptIdList);
    
    if (deptIdList && Array.isArray(deptIdList) && deptIdList.length > 0) {
      const primaryDeptId = String(deptIdList[0]);
      console.log('Processing primaryDeptId:', primaryDeptId);
      try {
        let deptName = `钉钉部门_${primaryDeptId}`;
        
        // 尝试获取真实的钉钉部门名称
        try {
          const deptResponse = await fetch(`https://api.dingtalk.com/v1.0/contact/departments/${primaryDeptId}`, {
            method: 'GET',
            headers: {
              'x-acs-dingtalk-access-token': tokenData.accessToken,
              'Content-Type': 'application/json',
            },
          });
          const deptData = await deptResponse.json();
          console.log('DingTalk Department API Response:', deptData);
          if (deptResponse.ok && deptData.name) {
            deptName = deptData.name;
          }
        } catch (apiError) {
          console.error('获取钉钉部门详情失败, 回退到默认名称:', apiError);
        }

        let dept = await prisma.department.findUnique({
          where: { dingtalkDeptId: primaryDeptId }
        });

        if (!dept) {
          console.log('Creating new department in database:', deptName);
          dept = await prisma.department.create({
            data: {
              name: deptName,
              dingtalkDeptId: primaryDeptId
            }
          });
        } else if (dept.name.startsWith('钉钉部门_') && deptName !== dept.name) {
          console.log('Updating existing department name to:', deptName);
          dept = await prisma.department.update({
            where: { id: dept.id },
            data: { name: deptName }
          });
        }
        departmentId = dept.id;
        console.log('Successfully resolved departmentId:', departmentId);
      } catch (deptError) {
        console.error('Failed to sync department:', deptError);
      }
    } else {
      console.log('No deptIdList found in user data or it is empty.');
    }

    // 3. Find or create user in our system
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { dingtalkUnionId: unionId },
          { email: userEmail || 'missing_email_from_dingtalk' },
        ],
      },
    });

    if (!user) {
      // 自动记录邮箱为账号密码默认12345678
      const defaultPassword = hashPassword('12345678');
      const accountEmail = userEmail || `${unionId}@dingtalk.local`;
      
      user = await prisma.user.create({
        data: {
          username: accountEmail,
          email: accountEmail,
          password: defaultPassword,
          name: nick,
          avatar: avatarUrl,
          dingtalkUnionId: unionId,
          dingtalkOpenId: openId,
          departmentId: departmentId,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update dingtalk info if missing
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          dingtalkUnionId: unionId,
          dingtalkOpenId: openId,
          avatar: user.avatar || avatarUrl,
          departmentId: departmentId || user.departmentId,
          lastLoginAt: new Date(),
        },
      });
    }

    // Return user info for frontend to save in localStorage
    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      credits: user.credits,
    });
  } catch (error) {
    console.error('DingTalk callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
