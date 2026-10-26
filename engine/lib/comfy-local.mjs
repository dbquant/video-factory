// ComfyUI API-format workflows. Submission and collection are separate for crash recovery.
import { randomUUID } from "node:crypto";
import { settings, request } from "./local-http.mjs";
const config = () => settings("VF_COMFY");
export function bindWorkflow(template, bindings, values) {
  const workflow = structuredClone(template);
  if (!workflow || Array.isArray(workflow) || typeof workflow !== "object" || workflow.nodes) throw new Error("Expected ComfyUI API-format workflow");
  for (const [field, targets] of Object.entries(bindings)) {
    if (!(field in values)) throw new Error(`Missing workflow value: ${field}`);
    if (!Array.isArray(targets) || !targets.length) throw new Error(`Invalid binding: ${field}`);
    for (const [node, input] of targets) {
      if (!Object.hasOwn(workflow, node) || !Object.hasOwn(workflow[node].inputs || {}, input)) throw new Error(`Invalid workflow target: ${node}.${input}`);
      workflow[node].inputs[input] = values[field];
    }
  }
  return workflow;
}
export async function submit(workflow) {
  const r = await request(config(), "prompt", { method: "POST", body: { prompt: workflow, client_id: randomUUID() } });
  const j = await r.json();
  if (!j.prompt_id || Object.keys(j.node_errors || {}).length) throw new Error("ComfyUI rejected workflow");
  return j.prompt_id;
}
export async function collect(id, { timeoutMs = 1800000, pollMs = 2000, outputNodes } = {}) {
  const c = config();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const j = await (await request(c, `history/${encodeURIComponent(id)}`, { timeoutMs: Math.max(1, Math.min(30000, deadline - Date.now())) })).json();
    const job = j[id];
    if (job?.status?.status_str === "error") throw new Error("ComfyUI generation failed; inspect server history");
    if (job?.status?.completed) {
      const files = [];
      for (const [node, output] of Object.entries(job.outputs || {})) {
        if (outputNodes && !outputNodes.includes(node)) continue;
        for (const kind of ["images", "gifs", "videos", "audio"]) {
          for (const file of output[kind] || []) {
            if (!file.filename || file.type === "temp") continue;
            const url = new URL("view", c.base);
            url.search = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder || "", type: file.type || "output" });
            files.push({ node, kind, filename: file.filename, url: url.href });
          }
        }
      }
      if (!files.length) throw new Error("ComfyUI completed without saved outputs");
      return files;
    }
    await new Promise(r => setTimeout(r, Math.min(pollMs, Math.max(0, deadline - Date.now()))));
  }
  throw new Error(`ComfyUI timed out; collect the same prompt ID again: ${id}`);
}
