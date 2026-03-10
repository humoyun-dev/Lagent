# 🧠 Lagent — AI Planner CLI

Local AI-powered task planner that runs entirely on your machine via [Ollama](https://ollama.com). Describe a task in plain language, get a structured execution plan with steps, CLI UX guidelines, and architecture recommendations — all in your terminal.

## Features

- **100% Local** — no cloud APIs, runs on Ollama models (DeepSeek, Qwen, Llama, etc.)
- **Interactive REPL** — Codex-style terminal with `/` command menu, autocomplete, history
- **Dynamic Token Budgeting** — automatically adjusts output tokens based on task complexity
- **Live Thinking Display** — watch the model reason in real-time (`think: true`)
- **Structured Output** — validated JSON plans with Zod schemas
- **Persistent Settings** — model, temperature, verbose mode saved to `~/.config/planner-agent/`
- **Raw-mode UI** — custom select/confirm/input prompts, no readline conflicts

## Quick Start

```bash
# Prerequisites: Node.js 18+ and Ollama running locally
ollama pull deepseek-r1:7b

# Install & run
npm install
npm start
```

## Usage

```
 ╭──────────────────────────────────────────────────────────╮
 │  🧠  AI Planner  (v1.0.0)                                │
 │                                                          │
 │  model:     deepseek-r1:7b   temperature: 0.5   verbose: off │
 │  directory: ~/projects/agent                             │
 │  context:   type a task below to get started             │
 ╰──────────────────────────────────────────────────────────╯

›  build a REST API for a todo app

  ◆ tokens: 2048  (code / architecture)

  ◆ Thinking...
```

### Commands

Type `/` and press Enter to open the interactive menu, or type commands directly:

| Command | Description |
|---|---|
| `/model` | Choose from locally installed Ollama models |
| `/verbose` | Toggle live thinking output |
| `/settings` | Configure temperature & max tokens |
| `/help` | List all commands |
| `/exit` | Quit |

### Autocomplete

Start typing `/` and matching commands appear below the prompt in real-time. Press `Tab` to complete.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate command history |
| `Tab` | Autocomplete command |
| `Esc` | Clear input |
| `Ctrl+C` | Exit |
| `Ctrl+D` | Exit |

## Dynamic Token Budgeting

The agent automatically estimates the right output token budget per task:

| Tier | Tokens | When |
|---|---|---|
| **light** | 1024 | Short, simple queries |
| **medium** | 1536 | Longer input (80+ words) |
| **heavy** | 2048 | Code / architecture keywords detected |
| **complex** | 3072 | Multi-step, code + architecture combined |

Heuristics analyze keyword density, code blocks, input length, and list items to pick the optimal tier.

## Project Structure

```
src/
├── cli/
│   ├── main.ts              # Entry point
│   ├── repl.ts              # Interactive REPL with raw-mode autocomplete
│   ├── args.ts              # CLI argument parsing
│   ├── settings.ts          # Persistent config (~/.config/planner-agent/)
│   ├── ollama-models.ts     # Fetch local models from Ollama API
│   └── menu.ts              # Settings menu
├── core/
│   ├── planner.ts           # Orchestrator: prompt → stream → validate → render
│   ├── prompt.ts            # System prompt (strict JSON output rules)
│   ├── schemas.ts           # Zod validation schemas
│   ├── token-budget.ts      # Dynamic token budget estimation
│   └── types.ts             # TypeScript interfaces
├── services/
│   ├── ollama.ts            # Ollama HTTP streaming (native fetch)
│   ├── stream-parser.ts     # NDJSON stream parser with thinking support
│   └── validator.ts         # JSON extraction + Zod validation
├── ui/
│   ├── renderer.ts          # Terminal rendering (plans, thinking, status)
│   ├── status.ts            # Status indicators
│   └── output.ts            # Output helpers
└── utils/
    ├── files.ts             # Save raw/parsed outputs to disk
    └── logger.ts            # Verbose debug logging
```

## Configuration

Settings persist at `~/.config/planner-agent/settings.json`:

```json
{
  "planner": {
    "model": "deepseek-r1:7b",
    "temperature": 0.5,
    "maxTokens": 2048,
    "verbose": false
  }
}
```

Change via `/settings` or `/model` in the REPL, or edit the file directly.

## Plan Output Format

Each plan is a structured JSON with:

```json
{
  "goal": "Build a REST API for a todo app",
  "analysis": "...",
  "assumptions": ["Node.js environment", "..."],
  "steps": [
    {
      "id": 1,
      "title": "Initialize project",
      "description": "...",
      "expected_result": "..."
    }
  ],
  "cli_ux": {
    "normal_mode": ["..."],
    "verbose_mode": ["..."],
    "error_handling": ["..."]
  },
  "future_extensions": [
    {
      "component": "...",
      "when_to_add": "...",
      "reason": "..."
    }
  ]
}
```

Plans are saved to `outputs/` as both raw responses and parsed JSON.

## Tech Stack

- **TypeScript** — strict mode, ESM, `nodenext` module resolution
- **tsx** — fast TypeScript execution (no build step for dev)
- **Ollama** — local LLM inference via `/api/generate`
- **Zod** — runtime schema validation with flexible coercions
- **chalk** — terminal colors
- **boxen** — header box rendering
- **Node.js readline** — `emitKeypressEvents` for raw-mode input

## Scripts

```bash
npm start        # Run the CLI
npm run dev      # Watch mode (auto-restart on changes)
npm run build    # Compile TypeScript to dist/
```

## Requirements

- Node.js ≥ 18
- [Ollama](https://ollama.com) running locally
- At least one model pulled (`ollama pull deepseek-r1:7b`)

## License

ISC
