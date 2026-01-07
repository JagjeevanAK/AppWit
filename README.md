# Appwit

An AI-powered code generation platform built as a Turborepo monorepo. Users describe what they want to build, and the system generates production-ready code files in an isolated sandbox environment.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [API Reference](#api-reference)
- [License](#license)

---

## Overview

Appwit enables users to generate complete web applications from natural language prompts. The platform leverages:

- **LangGraph State Machine** for orchestrating multi-step AI workflows
- **E2B Sandboxes** for secure, isolated code execution and file management
- **LLM Integration** supporting Anthropic Claude and OpenAI models
- **Real-time Streaming** for progressive file generation feedback

---

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph Client["Frontend (Next.js)"]
        UI[Web Interface]
        Editor[Monaco Editor]
        Preview[Sandbox Preview]
    end

    subgraph Server["Backend (Express/Bun)"]
        API[REST API]
        Auth[Auth Middleware]
        Orchestrator[LangGraph Orchestrator]
    end

    subgraph Agent["AI Agent Pipeline"]
        Planner[Planner Node]
        Coder[Coder Node]
        Theme[Theme Applicator]
        Cmd[Command Handler]
        Writer[Writer Node]
        Reviewer[Reviewer Node]
    end

    subgraph External["External Services"]
        LLM[LLM Provider<br/>Claude / OpenAI]
        E2B[E2B Sandbox]
        DB[(PostgreSQL)]
        S3[S3 Storage]
    end

    UI --> API
    API --> Auth
    Auth --> Orchestrator
    Orchestrator --> Agent
    Agent --> LLM
    Agent --> E2B
    API --> DB
    API --> S3
    Preview --> E2B
```

### UML Sequence Diagram: Code Generation Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Backend API
    participant Orchestrator
    participant LLM as LLM Provider
    participant E2B as E2B Sandbox

    User->>Frontend: Enter prompt
    Frontend->>API: POST /prompt/stream
    API->>E2B: Create sandbox
    E2B-->>API: Sandbox instance
    API->>Orchestrator: Start streaming pipeline

    Note over Orchestrator: Planning Phase
    Orchestrator->>LLM: Analyze prompt
    LLM-->>Orchestrator: Task plan
    Orchestrator-->>Frontend: Stream: plan_complete

    Note over Orchestrator: Code Generation Phase
    loop For each batch
        Orchestrator->>LLM: Generate code
        LLM-->>Orchestrator: File contents
        Orchestrator->>E2B: Write files progressively
        Orchestrator-->>Frontend: Stream: file_created
    end

    Note over Orchestrator: Command Execution
    Orchestrator->>E2B: Run npm commands
    E2B-->>Orchestrator: Command output
    Orchestrator-->>Frontend: Stream: executing

    Note over Orchestrator: Review Phase
    Orchestrator->>E2B: List files
    E2B-->>Orchestrator: File list
    Orchestrator-->>Frontend: Stream: review_complete

    alt Issues Found AND retryCount < 1
        Orchestrator->>LLM: Regenerate missing files
    end

    Orchestrator-->>Frontend: Stream: done
    Frontend->>E2B: Connect to preview URL
    E2B-->>Frontend: Live preview
    Frontend-->>User: Display result
```

---
## Project Structure

```
appwit/
├── apps/
│   ├── backend/                 # Express API server
│   │   ├── agent/               # LangGraph orchestrator
│   │   │   ├── nodes/           # Pipeline nodes
│   │   │   │   ├── planner.ts   # Task planning
│   │   │   │   ├── coder.ts     # Code generation
│   │   │   │   ├── writer.ts    # File writing
│   │   │   │   └── reviewer.ts  # Validation
│   │   │   ├── orchestrator.ts  # State machine
│   │   │   └── systemPrompts/   # LLM prompts
│   │   ├── routes/              # API endpoints
│   │   ├── middleware/          # Auth middleware
│   │   ├── prisma/              # Database schema
│   │   └── lib/                 # Utilities
│   └── frontend/                # Next.js application
│       ├── app/                 # App router pages
│       ├── components/          # React components
│       ├── hooks/               # Custom hooks
│       └── lib/                 # Utilities
├── docker/                      # Docker configurations
├── ops/                         # Deployment configs
├── turbo.json                   # Turborepo config
└── package.json                 # Root workspace
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.1.38 or higher
- PostgreSQL database
- E2B API key
- LLM provider API key (Anthropic or OpenAI)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/appwit.git
cd appwit
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment variables:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

4. Set up the database:

```bash
cd apps/backend
bunx prisma generate
bunx prisma db push
```

5. Start development servers:

```bash
bun run dev
```

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps for production |
| `bun run lint` | Run linting across all workspaces |
| `bun run clean` | Remove build artifacts |
| `bun run format` | Format code with Prettier |

### Run Specific Workspace

```bash
# Backend only
bun run dev --filter=@appwit/backend

# Frontend only
bun run dev --filter=@appwit/frontend
```

### Turborepo Features

- **Build Caching**: Caches build outputs to speed up subsequent builds
- **Task Orchestration**: Runs tasks in the correct order based on dependencies
- **Parallel Execution**: Runs independent tasks in parallel

---

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | Register new user |
| `/auth/signin` | POST | Login with credentials |
| `/auth/google` | POST | Google OAuth login |

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/project` | GET | List user projects |
| `/project` | POST | Create project |
| `/project/:id` | GET | Get project details |
| `/project/:id` | DELETE | Delete project |

### Code Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/prompt/stream` | POST | Stream code generation |
| `/prompt/files/:sandboxId` | GET | List sandbox files |
| `/prompt/file/:sandboxId` | GET | Read file content |

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health status |

---

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `PORT` | Server port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `E2B_API_KEY` | E2B sandbox API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_S3_BUCKET` | S3 bucket name |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |

---

## License

This project is private and proprietary.
