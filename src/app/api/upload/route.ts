
import { handleUpload, type HandleUploadBody } from '@vercel/blob/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // This callback is called before a token is generated.
        // It can be used to check for permissions, rate limiting, etc.
        return {
          allowedContentTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'],
          tokenPayload: JSON.stringify({
            // Optional payload to be passed to the onUploadCompleted callback
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This callback is called after the file has been uploaded.
        console.log('blob upload completed', blob, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }, // The webhook will retry 5 times waiting for a 200
    );
  }
}
