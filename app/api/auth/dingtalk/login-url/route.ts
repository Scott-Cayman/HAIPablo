import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.DINGTALK_CLIENT_ID || 'your_dingtalk_client_id';
  
  // 优先使用环境变量中配置的公网回调地址
  const defaultOrigin = process.env.APP_URL || request.nextUrl.origin;
  const redirectUri = process.env.DINGTALK_REDIRECT_URI || `${defaultOrigin}/auth/dingtalk/callback`;
  
  const state = Math.random().toString(36).substring(2, 15);
  
  const loginUrl = new URL('https://login.dingtalk.com/oauth2/auth');
  loginUrl.searchParams.append('client_id', clientId);
  loginUrl.searchParams.append('redirect_uri', redirectUri);
  loginUrl.searchParams.append('response_type', 'code');
  loginUrl.searchParams.append('scope', 'openid corpid');
  loginUrl.searchParams.append('state', state);
  loginUrl.searchParams.append('prompt', 'consent');

  return NextResponse.json({ url: loginUrl.toString(), state });
}
