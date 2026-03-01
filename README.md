# Tonari

[日本語版はこちら (Japanese)](README.ja.md)

A personal AI assistant with a 3D VRM avatar, powered by AWS Bedrock AgentCore.

Tonari is built on top of [AITuber-kit](https://github.com/tegnike/aituber-kit) and extends it with a conversational AI backend, persistent memory, and domain-specific knowledge (perfume expertise).

![Tonari](docs/images/screenshot.png)

## Features

- **3D Avatar** — Interactive VRM model with gestures, emotions, lip-sync, and auto-blink/look-at
- **Streaming Chat** — Real-time responses via AgentCore SSE
- **Persistent Memory** — Short-term and long-term memory for personalized conversations
- **Perfume Sommelier** — Searchable perfume database with detailed scent profiles
- **Web Search** — Tavily integration for up-to-date information
- **Multimodal Input** — Text and camera image support
- **Admin Dashboard** — Perfume data management with WebAuthn authentication

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, React 18, Tailwind CSS |
| 3D/Avatar | Three.js, @pixiv/three-vrm |
| State | Zustand |
| Backend | Python 3.12, Strands Agents |
| AI Model | Claude (via AWS Bedrock) |
| Memory | AgentCore Memory (LTM + STM) |
| Infrastructure | AWS Bedrock AgentCore, Lambda, DynamoDB |
| Deployment | Vercel (frontend), AgentCore Runtime (backend) |

## Documentation

- [Agent Tools Reference](docs/tools.md) — List of all MCP tools available to the Tonari agent
- [Tool Design](docs/tool-design/architecture.md) — Architecture and design docs for each tool

## License

This project is based on [AITuber-kit](https://github.com/tegnike/aituber-kit) and is intended for non-commercial use only. See the [LICENSE](LICENSE) file for details.

Original AITuber-kit portions are Copyright (c) 2024 tegnike.
