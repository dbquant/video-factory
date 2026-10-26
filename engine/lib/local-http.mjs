// Shared transport for explicitly configured local services. Never falls back to a paid provider.
import { env } from "./env.mjs";
export function settings(prefix) {
  const base = env(`${prefix}_BASE_URL`);
  const model = env(`${prefix}_MODEL`);
  if (!base) throw new Error(`Missing ${prefix}_BASE_URL`);
  const url = new URL(base.endsWith("/") ? base : base + "/");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Expected an HTTP service URL without embedded credentials");
  return { base: url, model, key: env(`${prefix}_API_KEY`) };
}
export async function request(config, endpoint, { method = "GET", body, timeoutMs = 120000 } = {}) {
  const headers = {};
  if (config.key) headers.Authorization = `Bearer ${config.key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(new URL(endpoint, config.base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  // Response bodies can contain credentials or prompts; keep errors bounded and private.
  if (!r.ok) throw new Error(`Local service HTTP ${r.status}`);
  return r;
}
export async function chat(messages, { prefix = "VF_TEXT", maxTokens = 4096 } = {}) {
  const config = settings(prefix);
  if (!config.model) throw new Error(`Missing ${prefix}_MODEL`);
  const r = await request(config, "chat/completions", { method: "POST", body: { model: config.model, messages, max_tokens: maxTokens, stream: false } });
  const j = await r.json();
  const text = j.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Local chat returned no text");
  return { model: config.model, text };
}
