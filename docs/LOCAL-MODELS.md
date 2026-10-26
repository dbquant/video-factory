# 本地模型适配：第一阶段

本分支在保留原项目云端工作流的基础上，新增可单独验证的本地接口。当前不是完整无人值守流水线；原有审批关卡不变。

## 配置

将 `.env.example` 中需要的 VF_* 配置复制到本机 `.env` 并取消注释。文本、视觉质检和语音服务使用包含 `/v1/` 的地址；ComfyUI 使用根地址。密钥仅放 `.env`，不要提交。示例地址均为占位地址。

- VF_TEXT_BASE_URL / VF_TEXT_MODEL / VF_TEXT_API_KEY：OpenAI 兼容文本接口。
- VF_JUDGE_BASE_URL / VF_JUDGE_MODEL / VF_JUDGE_API_KEY：支持图片输入的视觉模型。配置后原质检入口优先使用它；失败直接报错，不回退收费服务。
- VF_TTS_BASE_URL / VF_TTS_MODEL / VF_TTS_VOICE / VF_TTS_API_KEY：OpenAI 兼容语音接口，当前独立命令输出 WAV。
- VF_COMFY_BASE_URL / VF_COMFY_API_KEY：ComfyUI 服务。

## 验证命令

```powershell
npm ci
npm run test:local
node engine/local.mjs text prompt.txt
node engine/local.mjs tts narration.txt narration.wav
node engine/local.mjs comfy-status
node engine/local.mjs comfy-submit examples/local/qwen-image.workflow.json examples/local/qwen-image.bindings.json examples/local/qwen-image.values.json
node engine/local.mjs comfy-collect <返回的prompt-id>
```

`comfy-submit` 返回服务器任务 ID，必须保存；轮询超时后使用同一 ID 再次 `comfy-collect`，不要重新提交。当前输出为可下载资源列表，带认证的服务仍需凭据下载。执行提交前检查显存及其他服务；本阶段不自动启停模型或清空队列。

示例工作流来自既有成功测试的 Qwen Image / H3 图，依赖相应自定义节点、指定模型文件。它们不是通用 ComfyUI 标准工作流。H3 示例是文生视频，不具备已验证的角色参考图一致性。重新使用前应在当前服务检查节点和权重是否一致。

## 中文对齐

保留 Unicode 字母和数字，将汉字拆分为字符，以兼容 Whisper 不同分词粒度；调用端透传语言码，例如 zh。字符沿用识别词的时间范围，不虚构逐字精确时间。真实中文识别准确率、字幕字体与断行仍需成片验证。英语数字转写仅对英语启用。

## 测试与边界

`npm run test:local` 使用本机模拟 HTTP 服务，验证地址拼接、请求模型、质检路由、工作流绑定、结果收集、生成失败、超时不重提、错误信息脱敏，以及真实对齐入口的中文时间匹配。无需密钥、模型下载或 GPU。`npm test` 仍运行上游回归测试，需要 FFmpeg 和 Python numpy。

仍待实现：将本地图片/视频接入 gen 的预算与生产状态；本地配音替换完整 radio/edit 路径；参考图片上传；全局 GPU 队列与服务切换；统一资产下载；中文字幕样式；网页入口及 Concat 导出。不要把原有云端命令当成本地命令使用，尤其在 .env 同时存在云端密钥时。

## 上游同步

origin 为个人 Fork，upstream 为原仓库。main 保留上游，local-models 为长期集成分支；功能分支通过 PR 合并到 local-models。上游更新先同步 main，再将 main 合并进适配分支并运行两组测试，不用强制重置覆盖本地改动。

GitHub 是开发源，Gitee `dbquant/video-factory` 是国内部署镜像。`.github/workflows/mirror-gitee.yml` 在 GitHub 的任意分支或标签变化后，将所有 GitHub 分支和标签强制同步到 Gitee。工作流使用仓库 Secret `GITEE_TOKEN`；令牌不得写入代码、日志或文档。Gitee 上的同名分支和标签会以 GitHub 为准，不在镜像仓库直接开发。
