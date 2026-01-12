import { NextResponse } from "next/server";

// Example API route - GET /api/hello
export async function GET() {
    return NextResponse.json({
        message: "Hello from the API!",
        timestamp: new Date().toISOString()
    });
}

// Example API route - POST /api/hello
export async function POST(request: Request) {
    const body = await request.json();
    return NextResponse.json({
        received: body,
        message: "Data received successfully!"
    }, { status: 201 });
}
