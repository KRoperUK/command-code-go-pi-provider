# command-code-go-pi-provider

[![CI](https://github.com/KRoperUK/command-code-go-pi-provider/actions/workflows/ci.yml/badge.svg)](https://github.com/KRoperUK/command-code-go-pi-provider/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/command-code-go-pi-provider?color=CB3837)](https://www.npmjs.com/package/command-code-go-pi-provider)
[![license](https://img.shields.io/github/license/KRoperUK/command-code-go-pi-provider)](./LICENSE)

[Command Code](https://commandcode.ai) API provider for [Oh My Pi](https://github.com/can1357/oh-my-pi). Use Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Step, and other models through a single Command Code API key — all 21 models, one endpoint.

## Quick Start

### 1. Install

```bash
omp plugin install command-code-go-pi-provider
```

Or from git:

```bash
omp plugin install https://github.com/KRoperUK/command-code-go-pi-provider
```

For local development:

```bash
git clone https://github.com/KRoperUK/command-code-go-pi-provider
cd command-code-go-pi-provider
omp plugin link .
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
omp --model commandcode/deepseek/deepseek-v4-pro "Hello!"
```

Or inside a session:

```
/model deepseek/deepseek-v4-pro
/commandcode status
/commandcode models
/commandcode usage
```

## Available Models

21 models across all major providers:

| Provider | Models |
|---|---|
| Anthropic | Claude Haiku 4.5, Claude Sonnet 4.6, Claude Opus 4.7 |
| OpenAI | GPT-5.3 Codex, GPT-5.4, GPT-5.4 Mini, GPT-5.5 |
| DeepSeek | DeepSeek V4 Flash, DeepSeek V4 Pro |
| Google | Gemini 3.1 Flash Lite, Gemini 3.5 Flash |
| Qwen | Qwen 3.6 Max Preview, Qwen 3.6 Plus, Qwen 3.7 Max |
| Kimi | Kimi K2.5, Kimi K2.6 |
| GLM | GLM-5, GLM-5.1 |
| MiniMax | MiniMax M2.5, MiniMax M2.7 |
| Step | Step 3.5 Flash |

Use `omp models find commandcode` or `/commandcode models` for the full list with context windows and reasoning support.

## Commands

| Command | Description |
|---|---|
| `/commandcode` or `/commandcode status` | Show provider status and API key config |
| `/commandcode models` | List all available models with context windows |
| `/commandcode usage` | Show billing usage (requires `/login commandcode`) |
| `/commandcode refresh-models` | Reload the model catalog |
| `/login commandcode` | Set up API key and session token |

## Configuration

| Variable | Description |
|---|---|
| `COMMANDCODE_API_KEY` | Command Code API key (required) |
| `COMMANDCODE_PROJECT_SLUG` | Project identifier sent in API headers (default: `oh-my-pi`) |

Auth files checked (in order):
1. `~/.commandcode/auth.json`
2. `~/.pi/agent/auth.json`

Auth file format:
```json
{ "apiKey": "sk-...", "sessionToken": "..." }
```

## Architecture

This package is a native omp extension that registers a `commandcode` provider via `pi.registerProvider()`. It implements custom SSE streaming for the Command Code `/alpha/generate` endpoint, available on all Command Code plans. Message conversion handles text, reasoning/thinking, and tool calls bidirectionally.

## Development

```bash
bun install
bun run typecheck    # requires omp types (available when linked into omp)
bun run lint         # biome check
bun run lint:fix     # biome check --write
bun test             # run unit tests
bun run check        # lint + test
```

CI runs `lint` and `test` on every push and PR via GitHub Actions.

## License

MIT
