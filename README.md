# Product Concept: AI-Native Company Brain (Working Name)

## One-line Summary
A state-first, filesystem-backed AI system that continuously maintains a company’s canonical knowledge (plans, decisions, models, entities) from ongoing evidence (emails, calls, Slack), using AI to propose reviewable updates rather than execute opaque workflows.

---

## Core Philosophy

### Motivation
 - The things that are working in AI are (1) coding agents with a filesystem and agentic paradigms (over RAG), and tapping into new unstructured sources (transcription, emails, calendar). I want to combine those into a Zed-like UX for non-devs.
 - It is document centric. Like NotionAI but without all the prior SaaS baggage (and employing more of a filesystem which is AI native).

### State > Workflows
- We do not build agent workflows or DAGs.
- The system maintains **canonical state** (documents, models, entities).
- AI proposes **state transitions** (diffs/patches) based on new evidence.
- Humans review and merge changes (PR-style).

---

## Three-Layer Architecture

```
┌───────────────────────────────────────────────────────────┐
│  ENGAGEMENT (ephemeral)                                   │
│  Chat, exploration, drafts, what-ifs                      │
│  → promotes to ↓                                          │
├───────────────────────────────────────────────────────────┤
│  KNOWLEDGE (canonical)                                    │
│  Documents, Entities (nouns), Relationships (verbs)       │
│  ← extracts from ↓                                        │
├───────────────────────────────────────────────────────────┤
│  EVIDENCE (immutable)                                     │
│  Emails, transcripts, calendar, chat history              │
└───────────────────────────────────────────────────────────┘
```

### Evidence Layer (Bottom)
- **Immutable, append-only** — raw inputs are never modified
- Emails, call transcripts, calendar events, Slack messages
- Chat history from engagement layer also becomes evidence
- **Private by default** — user controls what gets promoted
- Always citable — knowledge claims link back to evidence

### Knowledge Layer (Middle)
- **Canonical, versioned** — the source of truth
- Documents (Roadmap, GTM, Decisions)
- Entities (nouns) + Relationships (verbs)
- Tables (declarative views over the graph)
- **Shared by default** — team alignment
- AI proposes changes; humans approve via diffs

### Engagement Layer (Top)
- **Ephemeral, interactive** — think ChatGPT
- Fast exploration, brainstorming, iteration
- Nothing canonical until explicitly promoted
- Session-based, private to the user
- Where the actual work happens

### Information Flow
- **Evidence → Knowledge**: AI extracts entities, relationships, claims from raw inputs
- **Engagement → Knowledge**: User approves diffs to persist insights as documents/entities
- **Engagement → Evidence**: Chat sessions are archived as searchable, citable evidence
- **Knowledge → Engagement**: AI uses docs/entities as context for conversations

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

## The Type System: Nouns & Verbs

The system maintains a **typed graph** where meaning emerges from two primitives:

### Nouns (Entity Types)
Nouns are the things in your company's world:
- **People** — teammates, customers, investors, candidates
- **Organizations** — companies, teams, departments
- **Projects** — initiatives, features, products
- **Events** — calls, meetings, emails (yes, these are nouns too)
- **Artifacts** — documents, decisions, deals

Each noun instance is a lightweight, evolving profile:
- Sparse (not all fields required)
- Editable (humans can correct)
- Confidence-scored (AI marks uncertainty)
- Evidence-backed (claims cite sources)
- Allowed to be wrong initially (refinement over time)

### Verbs (Relationship Types)
Verbs connect nouns with meaning:
- **works_at** — Person → Organization
- **owns** — Person → Project
- **participated_in** — Person → Call
- **mentioned_in** — Person → Email
- **decided** — Person → Decision
- **reports_to** — Person → Person
- **client_of** — Organization → Organization

Verbs are:
- Named in plain English (AI and humans both understand)
- Typed (constrain which nouns can connect)
- Directional (subject → object)
- Evidence-backed (where did we learn this?)
- Confidence-scored (how sure are we?)

### Why This Matters

**For AI**: Verbs are the structure that lets AI reason. "Show me everyone who works_at Acme" is unambiguous. "Show me calls where Alice participated_in" becomes a graph traversal.

**For Tables**: When you drop "People" on rows and "Calls" on values, the system finds the verb (participated_in) that connects them. No manual joins.

**For Humans**: Plain English names mean you don't need to learn a schema. "Alice owns the Dashboard project" reads naturally and maps directly to the graph.

### Taxonomy Evolution
The set of nouns and verbs **emerges over time**:
- System starts with core types (Person, Organization, Project)
- AI proposes new types when patterns emerge ("we keep seeing 'Feature' — should this be a type?")
- Aliases and fuzzy matching handle variations ("works_at" = "employed_by" = "employee_of")
- Users can accept/reject/merge proposed types
- No need to define everything upfront

### Mentions vs Relationships
- **Mentions**: automatic, high-volume references (text occurrences). "Alice was mentioned in 47 emails."
- **Relationships**: meaningful, labeled claims with verbs. "Alice works_at Acme."
- Mentions ≠ meaning. A mention is evidence; a relationship is a conclusion.

### Mini Profiles Everywhere
The same thin-profile pattern applies to all nouns:
- users, teammates, customers, investors
- Avoids CRM heaviness while capturing tribal knowledge
- Every noun can have relationships via verbs

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
