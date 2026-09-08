import { NextRequest, NextResponse } from 'next/server';
import { testWordPressConnection } from '@/lib/wordpress';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wpUrl, wpUsername, wpAppPassword, openaiApiKey } = body;

    const wpResult = await testWordPressConnection(wpUrl, wpUsername, wpAppPassword);

    let openaiResult = { success: false, message: 'OpenAI API key not provided' };
    const aiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (aiKey) {
      try {
        const openai = new OpenAI({ apiKey: aiKey });
        // Quick lightweight check
        await openai.models.list();
        openaiResult = { success: true, message: 'OpenAI API Key verified successfully!' };
      } catch (err: any) {
        openaiResult = { success: false, message: `OpenAI verification error: ${err.message}` };
      }
    }

    return NextResponse.json({
      wordpress: wpResult,
      openai: openaiResult,
      overallSuccess: wpResult.success && openaiResult.success,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
