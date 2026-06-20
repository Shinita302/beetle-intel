import { NextResponse } from 'next/server';
import type { LlmBlockParseResult } from '@/utils/importLlmFallback';

const SYSTEM_PROMPT = `You parse beetle breeder inventory spreadsheet blocks into JSON.
Return ONLY valid JSON with keys:
species, line_name, origin, generation, egg_count, l1_count, l2_count, l3_count, pre_pupa_count, pupa_count, adult_count, notes.
Rules:
- species/line_name is the stock line (e.g. Giraffe.K), never a date note.
- origin must be CB, WC, WD, CBF1, WDF1 or empty.
- generation must be F1, F2, F3, F4, F4+ or empty.
- Numeric rows after an adult header belong to adult_count unless labeled L1/L2/L3.
- Observation notes go in notes, not species.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'LLM fallback not configured' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { rows?: string[][]; notes?: string[] };
    const rows = body.rows ?? [];
    const notes = body.notes ?? [];

    const userContent = JSON.stringify({ inventory_rows: rows, observation_notes: notes }, null, 2);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMPORT_MODEL ?? 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'LLM request failed' }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Empty LLM response' }, { status: 502 });
    }

    const parsed = JSON.parse(content) as LlmBlockParseResult;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to parse block' }, { status: 500 });
  }
}
