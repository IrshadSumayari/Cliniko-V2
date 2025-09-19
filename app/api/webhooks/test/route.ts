import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return NextResponse.json({ 
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    bodyLength: body.length,
    headers: Object.fromEntries(request.headers.entries())
  });
}
