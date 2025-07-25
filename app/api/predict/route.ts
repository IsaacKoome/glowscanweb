import { NextResponse } from 'next/server';

export const runtime = 'edge'; // Opt into Edge Runtime for faster responses

export async function POST(request: Request) {
  // 1. Get auth headers
  const headers = {
    'X-User-ID': request.headers.get('X-User-ID') || '',
    'Content-Type': 'multipart/form-data' // Forward content type
  };

  // 2. Clone the request body (can only be read once)
  const formData = await request.formData();
  
  try {
    // 3. Forward to your FastAPI backend
    const backendResponse = await fetch(`${process.env.BACKEND_URL}/predict`, {
      method: 'POST',
      headers,
      body: formData
    });

    // 4. Handle backend errors
    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Analysis failed', details: error },
        { status: backendResponse.status }
      );
    }

    // 5. Return successful response
    return NextResponse.json(await backendResponse.json());

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}