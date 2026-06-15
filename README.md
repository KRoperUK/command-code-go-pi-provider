# command-code-go-pi-provider

[Command Code](https://commandcode.ai) API provider for [Oh My Pi](https://github.com/ifiokjr/oh-pi) (omp/pi-coding-agent).

Use Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Step, and other models through a single Command Code API key.

## Quick Start

### 1. Install

```bash
omp plugin install npm:@kr/kr-operuk/command-code-go-pi-provider
```

Or install from git:

```bash
omp plugin install https://github.com/KRoperUK/command-code-go-pi-provider
```

### 2. Set API Key

```bash
export COMMANDCODE_API_KEY="your-key-here"
```

Or create `~/.commandcode/auth.json`:

```json
{ "apiKey": "your-key-here" }
```

### 3. Use

```bash
omp --model deepseek/deepseek-v4-flash "Hello!"
```

Or inside a session:

```
/model deepseek/deepseek-v4-flash
/commandcode status
/commandcode models
```

## Available Models

21 models across all major providers:

| Provider | Models |
|----------|--------|
| Anthropic | Claude Haiku 4.5, Claude Sonnet 4.6, Claude Opus 4.7 |
| OpenAI | GPT-5.3 Codex, GPT-5.4, GPT-5.4 Mini, GPT-5.5 |
| DeepSeek | DeepSeek V4 Flash, DeepSeek V4 Pro |
| Google | Gemini 3.1 Flash Lite, Gemini 3.5 Flash |
| Qwen | Qwen 3.6 Max Preview, Qwen 3.6 Plus, Qwen 3.7 Max |
| Kimi | Kimi K2.5, Kimi K2.6 |
| GLM | GLM-5, GLM-5.1 |
| MiniMax | MiniMax M2.5, MiniMax M2.7 |
| Step | Step 3.5 Flash |

## Commands

- `/commandcode` or `/commandcode status` — show provider status and API key config
- `/commandcode models` — list all available models with context windows
- `/commandcode refresh-models` — reload the model catalog

## Environment Variables

| Variable | Description |
|----------|-------------|
| `COMMANDCODE_API_KEY` | Command Code API key (required) |

## Architecture

This package is a native pi extension that registers a `commandcode` provider via `pi.registerProvider()`. It implements custom streaming for the Command Code `/alpha/generate` endpoint, which is the endpoint available on all Command Code plans (Go, Provider, etc.).

For users on Provider plans or higher, an OpenAI-compatible endpoint is also available at `/provider/v1/chat/completions`, but this provider targets the widely-compatible `/alpha/generate` endpoint.

## License

MIT
