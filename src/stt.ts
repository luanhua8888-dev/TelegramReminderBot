// Nhận diện giọng nói tiếng Việt qua API kiểu OpenAI (/audio/transcriptions).
// Tương thích với OpenAI Whisper (whisper-1), Groq (whisper-large-v3-turbo), Faster-Whisper, LocalAI...

import { config } from "./config.ts";

export function parseSttResponse(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const text = (raw as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}

export async function transcribeAudio(audioBytes: Uint8Array, fileName = "voice.ogg"): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([audioBytes as BlobPart], { type: "audio/ogg" });
  formData.append("file", blob, fileName);
  formData.append("model", config.stt.model);
  if (config.stt.language) {
    formData.append("language", config.stt.language);
  }

  const res = await fetch(`${config.stt.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      ...(config.stt.apiKey ? { Authorization: `Bearer ${config.stt.apiKey}` } : {}),
    },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`STT HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as unknown;
  return parseSttResponse(json);
}
