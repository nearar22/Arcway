// LLM client — works with any OpenAI-compatible endpoint
// Default: NVIDIA NIM (https://build.nvidia.com)
// Fallback: mock mode when no API key is set

const LLM_BASE_URL =
  process.env.LLM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-ai/deepseek-v3.2";

const MOCK_RESPONSES = [
  "This is a demo response (no LLM_API_KEY set). Your $0.001 USDC payment was verified on-chain. Add an API key to get real AI answers.",
  "Payment confirmed on Arc Testnet. Set LLM_API_KEY in .env.local to enable real LLM responses.",
];

export async function askLLM(prompt: string): Promise<string> {
  const key = process.env.LLM_API_KEY;

  // Demo fallback when no key is configured
  if (!key) {
    await new Promise((r) => setTimeout(r, 600));
    return `[Demo mode · no API key] You asked: "${prompt.slice(0, 80)}…"\n\n${MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]}`;
  }

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
      stream: false,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? json?.detail ?? `LLM error ${res.status}`);
  }

  return (
    json.choices?.[0]?.message?.content ?? "No response generated."
  );
}
