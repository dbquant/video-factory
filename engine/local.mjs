#!/usr/bin/env node
// Explicit local diagnostics and generation primitives; production approvals remain in studio.mjs.
import fs from "node:fs";
import path from "node:path";
import { chat, settings, request } from "./lib/local-http.mjs";
import { bindWorkflow, submit, collect } from "./lib/comfy-local.mjs";
const [command, ...args] = process.argv.slice(2);
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
try {
  if (command === "text") {
    if (!args[0]) throw new Error("Provide a UTF-8 prompt file");
    console.log((await chat([{ role: "user", content: fs.readFileSync(args[0], "utf8") }])).text);
  } else if (command === "comfy-submit") {
    if (args.length !== 3) throw new Error("Provide workflow, bindings and values JSON files");
    console.log(JSON.stringify({ prompt_id: await submit(bindWorkflow(read(args[0]), read(args[1]), read(args[2]))) }));
  } else if (command === "comfy-collect") {
    if (!args[0]) throw new Error("Provide the original prompt ID");
    console.log(JSON.stringify(await collect(args[0]), null, 2));
  } else if (command === "tts") {
    if (args.length !== 2) throw new Error("Provide a UTF-8 text file and output.wav");
    if (fs.existsSync(args[1])) throw new Error("Output already exists; choose another filename");
    const c = settings("VF_TTS");
    if (!c.model) throw new Error("Missing VF_TTS_MODEL");
    if (path.extname(args[1]).toLowerCase() !== ".wav") throw new Error("Local TTS output must be .wav");
    const { env } = await import("./lib/env.mjs");
    const r = await request(c, "audio/speech", { method: "POST", body: { model: c.model, input: fs.readFileSync(args[0], "utf8"), voice: env("VF_TTS_VOICE", "Vivian"), response_format: "wav" } });
    const data = Buffer.from(await r.arrayBuffer());
    if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WAVE") throw new Error("Local TTS did not return a WAV file");
    fs.mkdirSync(path.dirname(path.resolve(args[1])), { recursive: true });
    fs.writeFileSync(args[1], data, { flag: "wx" });
    console.log(args[1]);
  } else if (command === "comfy-status") {
    console.log(JSON.stringify(await (await request(settings("VF_COMFY"), "queue")).json()));
  } else {
    console.log("Usage: node engine/local.mjs text <prompt.txt> | tts <text.txt> <output.wav> | comfy-status | comfy-submit <workflow.json> <bindings.json> <values.json> | comfy-collect <prompt-id>");
    if (command) process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
