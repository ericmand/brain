# Engineering Design Decisions

This document captures specific technical decisions and their rationale. See BUILD_PLAN.md for the overall roadmap and README.md for product concepts.

---

## Table of Contents
- [Transcript Ingestion](#transcript-ingestion)
- [Desktop Capture App](#desktop-capture-app)

---

## Transcript Ingestion

### Overview

Transcripts are a primary evidence source. We support multiple ingestion paths:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRANSCRIPT SOURCES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │   Recall.ai     │    │    Gong API     │    │    Future      │  │
│  │   Desktop App   │    │   (import)      │    │   Integrations │  │
│  └────────┬────────┘    └────────┬────────┘    └───────┬────────┘  │
│           │                      │                     │           │
│           └──────────────────────┼─────────────────────┘           │
│                                  ▼                                  │
│                    ┌─────────────────────────┐                     │
│                    │   Transcript Ingestion  │                     │
│                    │        Pipeline         │                     │
│                    └────────────┬────────────┘                     │
│                                 ▼                                  │
│                    ┌─────────────────────────┐                     │
│                    │    Evidence Layer       │                     │
│                    │  (immutable storage)    │                     │
│                    └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recall.ai Integration

**What is Recall.ai?**
- API service for capturing meeting audio/video and generating transcripts
- Supports bot-based recording (joins meetings) and desktop recording
- We use the **Desktop Recording API** for local capture

**Why Desktop Recording over Bot Recording?**
- No bot joining meetings (less intrusive)
- Works for any audio on the machine (calls, voice memos, etc.)
- User has full control over what's recorded
- Works offline (upload later)

**Integration approach:**
- Recall.ai Desktop SDK requires a native app
- We build a minimal "capture companion" desktop app
- App handles: recording, local storage, upload to Recall.ai, sync status
- Web app handles: everything else (viewing, processing, knowledge management)

### Gong API Integration

**Use case:**
- Organizations already using Gong have historical transcript data
- Import existing transcripts rather than re-record

**Integration approach:**
- OAuth connection to Gong workspace
- Bulk import of historical transcripts
- Optional ongoing sync for new recordings
- Map Gong users → our Person entities

### Transcript Schema (Unified)

Regardless of source, transcripts are normalized to a common format:

```yaml
# /evidence/transcripts/{id}.yaml
type: Transcript
id: transcript-uuid
source:
  provider: recall.ai | gong | manual
  external_id: provider-specific-id
  recorded_at: 2024-01-15T10:30:00Z
  duration_seconds: 1847

participants:
  - name: "Alice Smith"
    entity_ref: person:alice-uuid  # linked after processing
    speaker_id: speaker_0
  - name: "Bob Jones"
    entity_ref: person:bob-uuid
    speaker_id: speaker_1

segments:
  - speaker_id: speaker_0
    start: 0.0
    end: 12.5
    text: "Thanks for joining, Bob. I wanted to discuss the Q2 roadmap."
  - speaker_id: speaker_1
    start: 12.5
    end: 24.3
    text: "Sure, I've been thinking about the authentication feature..."

# Extracted by AI (populated after ingestion)
extracted:
  entities: []      # people, orgs, projects mentioned
  claims: []        # factual statements
  action_items: []  # commitments, todos
  decisions: []     # choices made

privacy:
  owner: user:owner-uuid
  visibility: private | promoted
  promoted_at: null
```

### Future Sources (Placeholder)

- **Fireflies.ai** — similar to Recall.ai
- **Otter.ai** — API for existing Otter users  
- **Manual upload** — user uploads audio/video files, we transcribe via Whisper or Deepgram
- **Live transcription** — real-time capture during browser-based calls (WebRTC)

---

## Desktop Capture App

### Purpose

A minimal standalone desktop application for:
1. Recording local audio via Recall.ai Desktop SDK
2. Managing recording state (start/stop, pause)
3. Uploading recordings to Recall.ai for transcription
4. Syncing transcripts to the web app

**Explicitly NOT in scope for the desktop app:**
- Viewing transcripts
- Managing entities/documents
- AI chat interface
- Any knowledge layer features

The desktop app is a "capture peripheral" — the web app is the brain.

### Technical Approach

**Framework: Electron or Tauri?**

| Factor | Electron | Tauri |
|--------|----------|-------|
| Bundle size | ~150MB | ~10MB |
| Memory usage | Higher | Lower |
| Native integration | Good (Node.js) | Excellent (Rust) |
| Recall.ai SDK | Node.js SDK available | Would need bindings |
| Development speed | Faster (familiar stack) | Slower (Rust learning curve) |
| Auto-update | Built-in | Built-in |

**Decision: Electron (for now)**
- Recall.ai provides a Node.js SDK, making Electron the path of least resistance
- Bundle size matters less for a "set and forget" background app
- Can revisit Tauri later if performance becomes an issue

### App Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop Capture App                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   System Tray   │  │  Recording UI   │  │  Settings      │  │
│  │   (always on)   │  │  (mini window)  │  │  (auth, prefs) │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                   │           │
│           └────────────────────┼───────────────────┘           │
│                                ▼                               │
│                    ┌─────────────────────────┐                 │
│                    │    Recording Manager    │                 │
│                    │  - Start/stop capture   │                 │
│                    │  - Audio device select  │                 │
│                    │  - Local file storage   │                 │
│                    └────────────┬────────────┘                 │
│                                 │                              │
│                    ┌────────────▼────────────┐                 │
│                    │    Recall.ai SDK        │                 │
│                    │  - Desktop recording    │                 │
│                    │  - Upload management    │                 │
│                    │  - Transcript retrieval │                 │
│                    └────────────┬────────────┘                 │
│                                 │                              │
│                    ┌────────────▼────────────┐                 │
│                    │    Sync Service         │                 │
│                    │  - Auth with web app    │                 │
│                    │  - Push transcripts     │                 │
│                    │  - Status reporting     │                 │
│                    └─────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### User Experience

**Installation & Setup**
1. User downloads desktop app from our website
2. App installs to system tray (auto-start on boot option)
3. User authenticates via OAuth (opens browser, redirects back)
4. App is ready — minimal ongoing interaction needed

**Recording Flow**
1. User clicks tray icon → "Start Recording" (or global hotkey)
2. Small floating indicator shows recording state
3. User clicks "Stop Recording"
4. App uploads to Recall.ai in background
5. Transcript appears in web app when ready (push or poll)

**Tray Menu**
```
┌──────────────────────────┐
│ ● Recording (00:15:32)   │  ← status
├──────────────────────────┤
│ ⏹ Stop Recording         │
│ ⏸ Pause                  │
├──────────────────────────┤
│ Recent Recordings →      │  ← submenu
├──────────────────────────┤
│ Settings                 │
│ Open Web App             │
│ Quit                     │
└──────────────────────────┘
```

### Sync Protocol

**Desktop → Cloud → Web App**

1. Desktop app uploads audio to Recall.ai
2. Recall.ai processes and generates transcript
3. Recall.ai webhooks our backend (or we poll)
4. Backend stores transcript in evidence layer
5. Web app shows new transcript (push via WebSocket or poll)

**Authentication**
- Desktop app authenticates with our backend (not directly with Recall.ai)
- Backend holds Recall.ai API keys
- Desktop app gets short-lived tokens for upload

```
Desktop App                Our Backend               Recall.ai
     │                          │                        │
     │──── Auth (OAuth) ───────►│                        │
     │◄─── Session token ───────│                        │
     │                          │                        │
     │──── Request upload URL ─►│                        │
     │                          │──── Create session ───►│
     │◄─── Signed upload URL ───│◄─── Upload URL ────────│
     │                          │                        │
     │──── Upload audio ────────┼───────────────────────►│
     │                          │                        │
     │                          │◄─── Webhook: ready ────│
     │                          │──── Fetch transcript ─►│
     │                          │◄─── Transcript ────────│
     │                          │                        │
     │                    [Store in evidence layer]      │
     │                          │                        │
```

### Recording Behavior

**Auto-detection: Yes (Granola-style)**
- Detect when meeting apps launch (Zoom, Meet, Teams, etc.)
- Surface a prompt: "Recording available — Start?"
- User confirms to begin recording
- No silent/automatic recording — always user-initiated, but low-friction

**Audio sources:**
- System audio + microphone (capture both sides of conversation)
- Allow user to configure in settings

**Local storage:**
- Keep local copy until confirmed uploaded
- Delete local after successful sync (configurable)

**Offline mode:**
- Record locally, queue for upload
- Sync when back online

---

## Frontend Stack

### Framework: React (no meta-framework)

**Do we need Next.js/Remix/etc?**

Probably not. Here's why:

| Feature | Do We Need It? | Notes |
|---------|----------------|-------|
| SSR/SSG | No | This is an app, not a content site. No SEO concerns for the main product. |
| File-based routing | Meh | Nice but not essential. TanStack Router is better anyway. |
| API routes | No | Backend is separate (Convex). |
| Edge functions | No | Not a fit for our architecture. |

Meta-frameworks add complexity and opinions we don't need. A Vite + React setup gives us:
- Fast dev server and builds
- Full control over architecture
- Simpler mental model
- Easier to integrate with Convex's real-time model

**Decision: Vite + React + TypeScript**

### Routing: TanStack Router

TanStack Router is excellent and a good fit:
- Type-safe routing (catches errors at build time)
- First-class search params handling
- Loader patterns for data fetching
- Works great with Convex
- No framework lock-in

**Decision: TanStack Router**

### State Management

For server state: **Convex handles this** — real-time sync, no need for React Query or SWR.

For client state (UI state, drafts, ephemeral engagement layer):
- **Zustand** — simple, minimal boilerplate, works well with React
- Or just React context + useReducer for simpler cases

**Decision: Zustand for complex client state, React context for simple cases**

### Rich Text Editor

This is critical — the document editing experience is core to the product.

| Editor | Pros | Cons |
|--------|------|------|
| **TipTap** | Excellent API, very extensible, ProseMirror-based, great docs | Paid for some features (collab) |
| **Lexical** | Facebook-backed, good performance, MIT license | Steeper learning curve, less mature ecosystem |
| **Plate** | Built on Slate, lots of plugins | Slate has had instability issues |
| **BlockNote** | Block-based like Notion, built on TipTap | Less flexible, opinionated |

**Recommendation: TipTap**
- Best balance of power and developer experience
- ProseMirror foundation is battle-tested
- Extensions for everything we need (mentions, comments, tables)
- Collaboration features available (paid, but we may want them)
- Large community, good examples

For our use case (Markdown-centric, entity mentions, comments, diffs), TipTap's extension model is ideal.

**Decision: TipTap**

### Styling

**Tailwind CSS** — the obvious choice for a new React app in 2024+:
- Utility-first, fast iteration
- Great with component libraries
- No CSS file management
- Design system via config

For components, consider:
- **Radix UI primitives** — unstyled, accessible, composable
- **shadcn/ui** — Radix + Tailwind, copy-paste components (not a dependency)

**Decision: Tailwind + Radix primitives (via shadcn/ui patterns)**

---

## Backend Stack

### Convex for Application State

Convex is a good fit for the **engagement layer** and **real-time collaboration**:

- Real-time sync out of the box
- TypeScript end-to-end
- Reactive queries (UI auto-updates)
- Built-in auth integration
- Serverless functions for business logic

**Where Convex fits:**
- User sessions, preferences
- Chat/engagement layer (real-time conversation state)
- Collaboration features (presence, cursors)
- Notification state
- Transient UI state that needs sync

**Where Convex doesn't fit:**
- The filesystem/knowledge layer (that's Turso/AgentFS)
- Large blob storage (transcripts, audio files)

### Turso + AgentFS for Knowledge Layer

The knowledge layer (documents, entities, relationships) has different requirements:
- Git-like versioning
- File-based mental model
- Per-workspace isolation
- Offline-capable
- Diffable

**Turso** (libSQL, SQLite-compatible) is a good fit:
- SQLite semantics (great for AgentFS)
- Edge replication (low latency)
- Per-database isolation (one DB per workspace)
- Embedded option for offline/local-first

**AgentFS** (or similar SQLite-backed virtual FS):
- Files and directories abstraction
- Git-like commits and history
- Patch-based updates
- Runs on Turso

**Decision: Turso for knowledge layer storage, with AgentFS-style virtual filesystem on top**

### Storage for Blobs

Audio files, images, attachments need blob storage:
- **Cloudflare R2** — S3-compatible, no egress fees, good pricing
- Or **S3** if we need broader ecosystem compatibility

**Decision: Cloudflare R2 (revisit if needed)**

### The Two-Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│                     (React + TanStack)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────────┐
│       Convex          │       │     Turso + AgentFS           │
│  (real-time app state)│       │   (knowledge layer FS)        │
├───────────────────────┤       ├───────────────────────────────┤
│ • User sessions       │       │ • Documents (markdown)        │
│ • Engagement/chat     │       │ • Entities (nouns)            │
│ • Presence/cursors    │       │ • Relationships (verbs)       │
│ • Notifications       │       │ • Tables (definitions)        │
│ • UI state sync       │       │ • Version history             │
│                       │       │ • Evidence metadata           │
└───────────────────────┘       └───────────────────────────────┘
                                              │
                                              ▼
                                ┌───────────────────────────────┐
                                │      Cloudflare R2            │
                                │     (blob storage)            │
                                ├───────────────────────────────┤
                                │ • Audio files                 │
                                │ • Transcript raw files        │
                                │ • Images/attachments          │
                                └───────────────────────────────┘
```

**Why two databases?**

- Convex excels at real-time, reactive app state but isn't designed for filesystem semantics
- Turso/SQLite excels at structured, versioned data but doesn't have Convex's real-time primitives
- Each layer has different access patterns and consistency needs
- Separation allows independent scaling and evolution

**Bridge between them:**
- Convex functions can call Turso (via HTTP or libSQL client)
- Or: separate API layer that orchestrates both
- Real-time updates from knowledge layer can be pushed through Convex subscriptions

### Why AgentFS / Filesystem Abstraction Matters

**AI agents need filesystems.** The tools that work — Claude Code, Cursor, Devin — all operate on files. They understand paths, can read/write, generate diffs. This is the interaction model we want for AI maintaining knowledge.

### Local-First Architecture (Preferred)

**The filesystem lives client-side.** For instant, offline-capable UX:

- SQLite runs in the browser (WASM)
- AgentFS abstraction runs locally
- Reads and writes are instant (no network)
- Changes sync to Turso cloud in background
- Other clients see updates via sync
- Offline works naturally

This is the Linear/Figma model — local-first, sync in the background.

**SQLite-in-browser options to evaluate:**

| Option | Pros | Cons |
|--------|------|------|
| **TanStack DB** | Reactive queries, React-native, same ecosystem as Router | New (2025), sync story unclear |
| **Turso embedded replicas** | Built-in sync to Turso cloud, battle-tested | Less React-native, need own reactivity |
| **wa-sqlite + custom** | Full control | More work |

**Recommendation:** Evaluate TanStack DB first since we're already in that ecosystem. If sync with Turso works well, use it. Fall back to Turso embedded replicas if needed.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    React App                            │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│   ┌─────────────────────────▼───────────────────────────────┐   │
│   │                   AgentFS (local)                       │   │
│   │          • read/write/patch → instant                   │   │
│   │          • list/history → instant                       │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│   ┌─────────────────────────▼───────────────────────────────┐   │
│   │              SQLite (WASM / embedded)                   │   │
│   │              • files, commits, versions                 │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ background sync
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Turso Cloud                                 │
│                  (one DB per workspace)                         │
├─────────────────────────────────────────────────────────────────┤
│  • Source of truth for multi-client sync                        │
│  • AI backend reads/writes here too                             │
│  • Conflict resolution at sync layer                            │
└─────────────────────────────────────────────────────────────────┘
```

**Turso embedded replicas** make this simpler:
- Local SQLite file syncs bidirectionally with Turso cloud
- Turso handles conflict resolution
- AI backend connects to same Turso DB

**AI operates on the same filesystem:**
1. AI backend reads from Turso (cloud replica)
2. AI generates a patch/diff
3. Patch written to `pending_patches` table
4. User's local replica syncs, sees pending patch
5. User reviews in frontend (rendered diff view)
6. On approval, patch applied locally → syncs to cloud
7. Commit recorded with evidence links

### Schema

```sql
-- Core filesystem
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  content TEXT,
  content_hash TEXT,
  metadata JSON,
  updated_at INTEGER
);

-- Version history
CREATE TABLE commits (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  message TEXT,
  author TEXT,
  timestamp INTEGER,
  FOREIGN KEY (parent_id) REFERENCES commits(id)
);

CREATE TABLE file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  commit_id TEXT,
  content_hash TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id),
  FOREIGN KEY (commit_id) REFERENCES commits(id)
);

-- AI proposals (pending changes)
CREATE TABLE pending_patches (
  id TEXT PRIMARY KEY,
  path TEXT,
  diff TEXT,
  proposed_by TEXT,  -- 'ai' or user id
  evidence JSON,     -- links to evidence sources
  status TEXT,       -- 'pending' | 'accepted' | 'rejected'
  created_at INTEGER
);
```

**Why not just use Convex for everything?**
- Convex doesn't have filesystem semantics (paths, directories)
- No built-in versioning/history
- Not designed for local-first/offline
- Turso/SQLite is purpose-built for this
- Separation of concerns: Convex for real-time app state, Turso for durable knowledge

---

## Authentication

### Clerk

Clerk is a solid choice:
- Great DX, fast integration
- Supports OAuth providers we need (Google, Microsoft for email/calendar access)
- Built-in org/team support (useful for workspaces)
- Works with both Convex and custom backends
- Reasonable pricing

**Potential concerns:**
- Vendor lock-in (but auth is somewhat commoditized)
- Need to ensure it works smoothly with desktop app auth flow

**Alternatives considered:**
- **Auth0** — more enterprise, more complex, more expensive
- **Supabase Auth** — good, but we're not using Supabase
- **Roll our own** — not worth the time/risk

**Decision: Clerk**

### Desktop App Auth Flow

Desktop app needs to authenticate with our backend:

1. User clicks "Sign In" in desktop app
2. App opens system browser to Clerk-hosted sign-in
3. After auth, browser redirects to `brain://callback?token=...` (custom protocol)
4. Desktop app receives token, stores securely (Keychain/Credential Manager)
5. App uses token for API calls

This is the standard OAuth flow for desktop apps — Clerk supports it.

---

## AI Integration

### LLM Provider: OpenRouter

We use [OpenRouter](https://openrouter.ai) as our LLM gateway rather than direct provider APIs.

**Why OpenRouter over direct Claude API:**
- **Model flexibility**: Switch between Claude, GPT-4, Llama, etc. without code changes
- **Fallback options**: If one provider is down, can route to another
- **Single billing**: One API key, one bill, unified usage tracking
- **Future-proof**: New models available immediately without integration work

**Configuration:**
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-sonnet-4  # or other model
```

**Model selection strategy:**
- Default to Claude Sonnet for balance of quality/speed/cost
- Could expose model picker in UI later for power users
- Could use cheaper/faster models for simple tasks (entity extraction)
- Could use stronger models for complex tasks (document rewrites)

### AI Request/Response Format

**Context sent to AI:**
```typescript
{
  document: {
    path: string
    title: string
    content: string  // current document HTML
  }
  userMessage: string
  conversationHistory: Message[]
  // Future: relevant entities, user context doc
}
```

**Structured response from AI:**
```typescript
{
  message: string  // conversational response
  suggestion?: {
    description: string
    operations: Array<{
      type: 'insert' | 'replace' | 'delete'
      // For insert: where to insert and what
      // For replace: what to find and what to replace with
      // For delete: what to remove
      target?: string  // CSS selector, text match, or position
      content?: string  // new content (HTML)
    }>
  }
}
```

### Prompt Engineering

System prompt instructs the AI to:
1. Understand it's editing a document in a knowledge management system
2. Return structured JSON responses
3. Generate valid HTML content matching the document's style
4. Be specific about where changes should be made
5. Explain changes in plain language

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-XX-XX | Vite + React (no meta-framework) | App not content site, no SSR needed, simpler with Convex |
| 2024-XX-XX | TanStack Router | Type-safe, great DX, no framework lock-in |
| 2024-XX-XX | TipTap for rich text | Best extensibility, ProseMirror foundation, mentions/comments support |
| 2024-XX-XX | Tailwind + shadcn/ui patterns | Fast iteration, accessible primitives |
| 2024-XX-XX | Convex for engagement layer | Real-time sync, reactive queries, good DX |
| 2024-XX-XX | Turso + AgentFS for knowledge layer | SQLite semantics, versioning, per-workspace isolation |
| 2024-XX-XX | Cloudflare R2 for blobs | S3-compatible, no egress fees |
| 2024-XX-XX | Clerk for auth | Fast integration, org support, OAuth providers |
| 2024-XX-XX | Electron for desktop app | Recall.ai Node.js SDK compatibility, faster development |
| 2024-XX-XX | Desktop app is capture-only | Keep complexity in web app, desktop is a peripheral |
| 2024-XX-XX | Granola-style auto-detect recording | Low friction capture, user-initiated but prompted |
| 2024-XX-XX | Transcripts via Recall.ai first | Best-in-class desktop recording API |
| 2024-XX-XX | Gong as secondary source | Import path for existing Gong customers |
