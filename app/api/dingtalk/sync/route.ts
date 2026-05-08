import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 递归获取所有钉钉部门
async function fetchAllDingTalkDepartments(accessToken: string, parentDeptId: number = 1): Promise<any[]> {
  const departments: any[] = [];
  try {
    const response = await fetch(`https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dept_id: parentDeptId })
    });
    
    const data = await response.json();
    if (data.errcode === 0 && data.result) {
      for (const dept of data.result) {
        departments.push(dept);
        // 递归获取子部门
        const subDepts = await fetchAllDingTalkDepartments(accessToken, dept.dept_id);
        departments.push(...subDepts);
      }
    } else {
      console.error(`获取部门 ${parentDeptId} 的子部门失败:`, data);
    }
  } catch (error) {
    console.error(`获取部门 ${parentDeptId} 异常:`, error);
  }
  return departments;
}

// 获取部门下的所有用户详情
async function fetchDingTalkUsersInDept(accessToken: string, deptId: number): Promise<any[]> {
  const users: any[] = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      // 改为使用获取用户详情接口 listbypage (之前可能用了简易列表，没有unionid)
      const response = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept_id: deptId, cursor, size: 100 })
      });
      
      const data = await response.json();
      if (data.errcode === 0 && data.result && data.result.list) {
        users.push(...data.result.list);
        hasMore = data.result.has_more;
        cursor = data.result.next_cursor;
      } else {
        console.error(`获取部门 ${deptId} 用户失败:`, data);
        hasMore = false;
      }
    } catch (error) {
      console.error(`获取部门 ${deptId} 用户异常:`, error);
      hasMore = false;
    }
  }
  return users;
}

export async function POST() {
  try {
    const clientId = process.env.DINGTALK_CLIENT_ID;
    const clientSecret = process.env.DINGTALK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: '未配置钉钉 ClientID 或 ClientSecret' }, { status: 400 });
    }

    // 1. 获取企业 access_token (不同于用户的 access_token)
    const tokenResponse = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${clientId}&appsecret=${clientSecret}`);
    const tokenData = await tokenResponse.json();

    if (tokenData.errcode !== 0 || !tokenData.access_token) {
      console.error('获取钉钉 AccessToken 失败:', tokenData);
      return NextResponse.json({ 
        error: '获取钉钉企业凭证失败，请检查密钥并确保应用开通了通讯录权限。', 
        details: tokenData 
      }, { status: 401 });
    }

    const accessToken = tokenData.access_token;

    // 2. 获取并同步根部门(通常是公司名, dept_id=1) 
    let rootDeptName = '公司总部';
    try {
      const rootRes = await fetch(`https://oapi.dingtalk.com/topapi/v2/department/get?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept_id: 1 })
      });
      const rootData = await rootRes.json();
      if (rootData.errcode === 0 && rootData.result) {
        rootDeptName = rootData.result.name;
      }
    } catch(e) {}

    await prisma.department.upsert({
      where: { dingtalkDeptId: '1' },
      update: { name: rootDeptName },
      create: { name: rootDeptName, dingtalkDeptId: '1' }
    });

    // 3. 递归获取所有子部门并同步到数据库
    const allDingTalkDepts = await fetchAllDingTalkDepartments(accessToken, 1);
    console.log(`成功拉取到 ${allDingTalkDepts.length} 个钉钉部门`);

    // 构建一个映射便于关联 parentId
    const deptIdMap = new Map<string, string>(); // dingtalkDeptId -> local db id
    const rootLocalDept = await prisma.department.findUnique({ where: { dingtalkDeptId: '1' } });
    if (rootLocalDept) deptIdMap.set('1', rootLocalDept.id);

    // 首先创建/更新所有部门 (不含父子关系)
    for (const dept of allDingTalkDepts) {
      const dingtalkDeptId = String(dept.dept_id);
      const savedDept = await prisma.department.upsert({
        where: { dingtalkDeptId },
        update: { name: dept.name },
        create: { name: dept.name, dingtalkDeptId }
      });
      deptIdMap.set(dingtalkDeptId, savedDept.id);
    }

    // 再次循环更新父子关系
    for (const dept of allDingTalkDepts) {
      const dingtalkDeptId = String(dept.dept_id);
      const parentDingtalkId = String(dept.parent_id);
      const localId = deptIdMap.get(dingtalkDeptId);
      const localParentId = deptIdMap.get(parentDingtalkId);

      if (localId && localParentId) {
        await prisma.department.update({
          where: { id: localId },
          data: { parentId: localParentId }
        });
      }
    }

    // 3.5 清理本地存在但钉钉上已删除的部门 (保持双向同步)
    const validDingtalkDeptIds = Array.from(deptIdMap.keys());
    const deletedDepts = await prisma.department.deleteMany({
      where: {
        dingtalkDeptId: {
          not: null, // 只处理由钉钉同步过来的部门
          notIn: validDingtalkDeptIds // 如果不在钉钉的有效列表中，则删除
        }
      }
    });
    console.log(`清理了 ${deletedDepts.count} 个钉钉端已删除的部门`);

    // 4. 获取每个部门下的用户，并关联本系统的账号 (如果本系统有这个账号)
    let syncUserCount = 0;
    const allDeptIds = ['1', ...allDingTalkDepts.map(d => String(d.dept_id))];
    
    for (const deptIdStr of allDeptIds) {
      const users = await fetchDingTalkUsersInDept(accessToken, parseInt(deptIdStr));
      const localDeptId = deptIdMap.get(deptIdStr);
      
      if (!localDeptId) continue;

      for (const dUser of users) {
        // 调用 v2/user/get 获取用户绝对完整的详情（解决列表接口可能不返回企业邮箱的问题）
        let detailedUser = { ...dUser };
        try {
          const detailRes = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: dUser.userid })
          });
          const detailData = await detailRes.json();
          if (detailData.errcode === 0 && detailData.result) {
            detailedUser = { ...dUser, ...detailData.result };
            // 添加专门的日志打印，方便用户在终端中排查权限问题
            if (!detailedUser.org_email && !detailedUser.email) {
               console.log(`[DingTalk Sync] User ${dUser.userid} (${dUser.name}) API返回成功，但缺少 email 和 org_email。完整返回结果:`, JSON.stringify(detailData.result));
            }
          } else {
             console.error(`[DingTalk Sync] 获取用户 ${dUser.userid} 详细信息报错:`, detailData);
          }
        } catch (detailErr) {
          console.error(`获取用户 ${dUser.userid} 详细信息网络失败:`, detailErr);
        }

        const finalOrgEmail = detailedUser.org_email || detailedUser.email;

        // 尝试通过 unionid 或 userid 匹配本地用户
        const localUser = await prisma.user.findFirst({
          where: {
            OR: [
              { dingtalkUnionId: detailedUser.unionid || 'missing_unionid' },
              { dingtalkOpenId: detailedUser.userid }, // userid 对应 openId
              { username: detailedUser.userid } // username 可能是 userid
            ]
          }
        });

        if (localUser) {
          await prisma.user.update({
            where: { id: localUser.id },
            data: { 
              departmentId: localDeptId,
              name: detailedUser.name || localUser.name,
              avatar: detailedUser.avatar || localUser.avatar,
              dingtalkUnionId: detailedUser.unionid || localUser.dingtalkUnionId,
              dingtalkOpenId: detailedUser.userid || localUser.dingtalkOpenId,
              // 如果本地原来是 dingtalk.local 伪邮箱，或者是空的，尝试更新为真实的
              email: (localUser.email?.endsWith('@dingtalk.local') || !localUser.email) && finalOrgEmail
                ? finalOrgEmail 
                : localUser.email
            }
          });
          syncUserCount++;
        } else {
          // 本地没有该用户，自动创建
          try {
            const defaultPassword = Buffer.from('12345678').toString('base64');
            const accountEmail = finalOrgEmail || `${detailedUser.userid}@dingtalk.local`;
            
            await prisma.user.create({
              data: {
                username: detailedUser.userid || `user_${Date.now()}`, // 使用 userid 作为登录账号
                email: accountEmail,
                password: defaultPassword,
                name: detailedUser.name,
                avatar: detailedUser.avatar,
                dingtalkUnionId: detailedUser.unionid,
                dingtalkOpenId: detailedUser.userid,
                departmentId: localDeptId
              }
            });
            syncUserCount++;
          } catch (createErr) {
            console.error(`自动创建用户失败 (userid: ${detailedUser.userid}):`, createErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `同步成功！共更新 ${allDingTalkDepts.length + 1} 个部门架构，成功同步了 ${syncUserCount} 名用户。`
    });

  } catch (error: any) {
    console.error('钉钉全量同步异常:', error);
    return NextResponse.json({ error: '同步过程发生异常: ' + error.message }, { status: 500 });
  }
}
