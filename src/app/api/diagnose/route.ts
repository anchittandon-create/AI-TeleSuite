import { NextResponse } from 'next/server';

export const runtime = 'edge';

export function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    return NextResponse.json({ message: 'Token is present.' });
  }
  return NextResponse.json({ message: 'Token is MISSING.' }, { status: 500 });
}
