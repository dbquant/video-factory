import assert from "node:assert/strict";
import http from "node:http";
import { chat } from "../engine/lib/local-http.mjs";
import { bindWorkflow, submit, collect } from "../engine/lib/comfy-local.mjs";
const seen = [];
let mode = "ok";
const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  seen.push({ url: req.url, body: body ? JSON.parse(body) : null, auth: req.headers.authorization });
  res.setHeader("Content-Type", "application/json");
  if (mode === "http-error") { res.writeHead(401); res.end('{"secret":"never print this"}'); return; }
  if (req.url === "/v1/chat/completions") res.end(JSON.stringify({ choices: [{ message: { content: "你好" } }] }));
  else if (req.url === "/prompt") res.end(JSON.stringify({ prompt_id: "job1", node_errors: {} }));
  else res.end(JSON.stringify(mode === "pending" ? {} : { job1: { status: { completed: true, status_str: mode === "failed" ? "error" : "success" }, outputs: { 9: { images: [{ filename: "a b.png", type: "output", subfolder: "中文" }] } } } }));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.VF_TEXT_BASE_URL = base + "/v1";
  process.env.VF_TEXT_MODEL = "local-test";
  process.env.VF_COMFY_BASE_URL = base;
  process.env.VF_JUDGE_BASE_URL = base + "/v1/";
  process.env.VF_JUDGE_MODEL = "vision-test";
  assert.equal((await chat([{ role: "user", content: "test" }])).text, "你好");
  assert.equal(seen[0].body.model, "local-test");
  const { judge } = await import("../engine/lib/judge.mjs");
  assert.equal((await judge([{ type: "text", text: "inspect" }])).model, "vision-test");
  const template = { 1: { class_type: "Test", inputs: { text: "before" } } };
  const graph = bindWorkflow(template, { prompt: [["1", "text"]] }, { prompt: "after" });
  assert.equal(template[1].inputs.text, "before");
  assert.equal(graph[1].inputs.text, "after");
  assert.throws(() => bindWorkflow(template, { prompt: [["2", "text"]] }, { prompt: "x" }));
  assert.throws(() => bindWorkflow(template, { prompt: [["1", "text"]] }, {}));
  assert.equal(await submit(graph), "job1");
  const files = await collect("job1", { pollMs: 1, timeoutMs: 500 });
  assert.equal(new URL(files[0].url).searchParams.get("filename"), "a b.png");
  assert.equal(new URL(files[0].url).searchParams.get("subfolder"), "中文");
  mode = "failed";
  await assert.rejects(collect("job1"), /generation failed/);
  mode = "pending";
  await assert.rejects(collect("job1", { pollMs: 2, timeoutMs: 30 }), /timed out|timeout/i);
  assert.equal(seen.filter(r => r.url === "/prompt").length, 1, "Polling must not resubmit");
  mode = "http-error";
  await assert.rejects(chat([]), { message: "Local service HTTP 401" });
  console.log("Local interface checks passed (mock HTTP; no GPU or paid calls).");
} finally {
  server.closeAllConnections();
  await new Promise(r => server.close(r));
}
