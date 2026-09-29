import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isConfigured = Boolean(
    process.env.MP_ACCESS_TOKEN && process.env.MP_ACCESS_TOKEN.trim().length > 0
  );
  return NextResponse.json({ isConfigured });
}
