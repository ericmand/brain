# Product Concept: AI-Native Company Brain (Working Name)

## One-line Summary
A state-first, filesystem-backed AI system that continuously maintains a company’s canonical knowledge (plans, decisions, models, entities) from ongoing evidence (emails, calls, Slack), using AI to propose reviewable updates rather than execute opaque workflows.

---

## Core Philosophy

### Motivation
 - The things that are working in AI are (1) coding agents with a fileystem and agentic paradugms (over RAG), and tapping into new unstructured sources (transcription, emails, calendar). I want to combine those into a Zed-like UX for non-devs.
 - It is document centric. Like NotionAI but with out all the prior SaaS baggage (and employing more of a filesystem which is AI native).

### State > Workflows
- We do not build agent workflows or DAGs.
- The system maintains **canonical state** (documents, models, entities).
- AI proposes **state transitions** (diffs/patches) based on new evidence.
- Humans review and merge changes (PR-style).

### Evidence vs Knowledge
- **Evidence** = raw inputs (emails, transcripts, Slack messages).
- **Knowledge** = distilled, durable artifacts (roadmap, GTM, decisions, models).
- Evidence is often **private by default**.
- Knowledge is often **shared by default**.
- Knowledge objects always cite evidence, which may be permission-gated.

---

## Canonical Substrate: Filesystem First

### Filesystem as Source of Truth
- Canonical state lives in a **synced filesystem** (virtual FS).
- All edits happen as **patches to files**.
- Files are LLM-native: Markdown, YAML, small DSLs.
- Everything else (indexes, search, embeddings) is **derived**.

### Repo Mental Model
- Company state is treated like a repo:
  - Versioned
  - Diffable
  - Auditable
  - Portable
- AI outputs patches, not final text blobs.

---

## Primary Artifacts (Canonical)

### Documents
- Roadmap
- GTM Plan
- Decisions Log
- Financial Models
- Customer / Partner Summaries
- User Context Docs

Stored as Markdown (rendered in UI).

### Financial Models
- Canonical form is a **textual DSL** (YAML + expressions).
- Spreadsheet/grid is a **rendered view**, not source of truth.
- Cell edits map back to:
  - assumptions
  - overrides
  - formula changes
- Enables AI-safe maintenance + human spreadsheet UX.

---

## Entities & Relationships

### Entities (Thin Profiles)
All important nouns get a lightweight, evolving profile:
- People
- Organizations
- Products
- Projects / Features (initially)

Profiles are:
- Sparse
- Editable
- Confidence-scored
- Evidence-backed
- Allowed to be wrong initially

### Mentions vs Relationships
- **Mentions**: automatic, high-volume references (text occurrences).
- **Relationships**: meaningful, labeled claims (owner_of, client_of, works_at).
- Relationships are proposed, reviewed, cited, and confidence-scored.
- Mentions ≠ meaning.

### Mini Profiles Everywhere
- Same thin-profile pattern applies to:
  - users
  - teammates
  - customers
  - investors
- Avoids CRM heaviness while capturing tribal knowledge.

---

## User Context & Org Context

### User Context as a Document
Each user has a top-level, editable context doc:
- Role
- Objectives
- Authority
- Working style (optional)

AI must read this before acting.
Inference is allowed, but **must be user-approved**.

### Org Chart
- Explicit org structure is captured as a doc.
- Includes reporting lines and informal collaboration.
- Critical for correct AI behavior (who decides, who to ask).

---

## Inputs / Evidence Sources

### Email
- Private by default.
- Shared via explicit actions (labels, “share to workspace”).
- Entities/claims may be promoted with user approval.

### Calls / Transcripts
- Raw transcripts/audio are private by default.
- System extracts:
  - entities
  - claims
  - decisions
  - action items
- Only derived knowledge is shared by default.

### Slack
- No passive surveillance.
- Channel-scoped ingestion only.
- Message-level promotion (“Add to Company Brain”).
- Slash commands + message actions.
- Slack is an **input signal**, not a system of record.

---

## Derived Artifacts (Mutable / Regeneratable)

From raw evidence we derive:
- Summaries (versioned, cacheable, not truth)
- Claims (atomic facts with structure)
- Action items
- Decision candidates
- Topic tags
- Embeddings / search indexes

Derived views can be regenerated as context improves.
Evidence is never overwritten.

---

## Comments & Collaboration

### Unified Thread Model
- Comments are threads anchored to:
  - doc ranges
  - blocks
  - spreadsheet cells
  - diffs / PRs
- Same UX surface for humans and AI.

### AI in Comments
- AI replies are **structured**, not chatty:
  - answer
  - suggestion (diff)
  - question
- Suggestions attach diffs + evidence.
- Humans approve/merge.

---

## Collaboration Model

### Default Stance
- Raw evidence: private
- Knowledge artifacts: shared
- Promotion is intentional

### Workspace Modes (later)
- Private evidence mode (default)
- Shared library mode (sales-style)
- Hybrid

Avoids Gong-style surveillance for general users.

---

## External SaaS Systems (Later)

### Principle
> If something has a better owner elsewhere, we never become the owner.

- Do **not** import Salesforce/Jira/Zendesk as canonical entities.
- Long-term: allow **read-only, agentic queries** as ephemeral evidence.
- Promote only high-level abstractions (claims, summaries).
- No sync, no mirroring, no expectation of editability.

---

## UI Direction

### Target User
- Non-developers (founders, PMs, researchers, operators).

### UI Layers
- Docs-first / Collections-based UI (default).
- Filesystem is hidden but real.
- Advanced “repo view” possible later.

### Platform
- Web-first (React).
- Mobile later for review/approval, not heavy editing.

---

## Architecture Direction

### Core
- Virtual filesystem as canonical state.
- Patch-based edits.
- Event/log-based sync.

### Possible Infrastructure
- AgentFS (SQLite-backed filesystem) as workspace container.
- Cloud sync + indexing layer.
- Daytona-style sandbox for agent execution (terminal, tools).

### Backend Role
- Sync
- Permissions
- Event log
- Derived indexes
- Ingestion pipelines

Not a traditional CRUD backend.

---

## What This Is NOT

- Not a workflow builder
- Not a DAG UI
- Not a CRM replacement
- Not a meta-Jira
- Not a chat-first AI tool

---

## North Star

> AI that keeps a company’s plans, decisions, and models correct over time —  
> by maintaining state, not running workflows.
