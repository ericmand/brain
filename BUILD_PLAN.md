# Build Plan: AI-Native Company Brain

## System Architecture: Three Layers

The system has three distinct layers with clear information flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ENGAGEMENT LAYER (ephemeral, interactive)                             │
│                                                                         │
│   - AI chat conversations (like ChatGPT)                                │
│   - Explorations, what-ifs, brainstorming                               │
│   - Draft iterations before committing                                  │
│   - Real-time collaboration                                             │
│                                                                         │
│   This is where users WORK — fast, messy, experimental.                 │
│   Nothing here is canonical until explicitly promoted.                  │
│                                                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                     promotes to ↓  (user approves diffs)
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                                                                         │
│   KNOWLEDGE LAYER (canonical, versioned, shared)                        │
│                                                                         │
│   - Documents (Roadmap, GTM Plan, Decisions, Specs)                     │
│   - Entities (Nouns: People, Orgs, Projects)                            │
│   - Relationships (Verbs: works_at, owns, participated_in)              │
│   - Tables (declarative views over the graph)                           │
│                                                                         │
│   This is the SOURCE OF TRUTH — durable, auditable, diffable.           │
│   AI proposes changes; humans approve.                                  │
│                                                                         │
└──────────────────────────────▲──────────────────────────────────────────┘
                               │
                     extracts from ↑  (AI processes, proposes)
                               │
┌──────────────────────────────┴──────────────────────────────────────────┐
│                                                                         │
│   EVIDENCE LAYER (immutable, append-only, mostly private)               │
│                                                                         │
│   - Emails (synced from Gmail/Outlook)                                  │
│   - Transcripts (calls, meetings)                                       │
│   - Calendar events                                                     │
│   - Slack messages                                                      │
│   - Chat history from engagement layer (becomes evidence!)              │
│                                                                         │
│   This is the RAW INPUT — never modified, always citable.               │
│   Private by default. Entities/claims promoted with permission.         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layer Interactions

**Evidence → Knowledge** (extraction)
- AI continuously processes new evidence
- Proposes new entities, relationships, document updates
- Extracts claims, action items, decisions
- All proposals require human review

**Engagement → Knowledge** (promotion)
- Chat explorations can produce document drafts
- User approves: "Save this as the GTM Plan"
- Diffs applied to canonical documents
- Chat history itself becomes evidence

**Engagement → Evidence** (archival)
- Chat sessions are persisted as evidence
- Searchable, citable in future work
- "In our conversation on Jan 5, we discussed..."

**Knowledge → Engagement** (context)
- AI reads relevant docs/entities before responding
- Tables inform chat answers
- "Based on your Roadmap, here's what I'd suggest..."

### Why Three Layers?

| Layer | Mutability | Visibility | Purpose |
|-------|------------|------------|---------|
| Engagement | Ephemeral | Private (session) | Think, explore, iterate |
| Knowledge | Versioned | Shared (team) | Persist, decide, align |
| Evidence | Immutable | Private (default) | Ground, cite, audit |

---

## Interaction Model

The core UX follows an **AI IDE pattern** with three primary panes:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Left Pane          │   Center Pane              │   Right Pane        │
│  (Navigation)       │   (Artifact Viewer/Editor) │   (AI Conversation) │
│                     │                            │                     │
│  ┌───────────────┐  │   ┌──────────────────────┐ │   ┌───────────────┐ │
│  │ Documents     │  │   │                      │ │   │ Chat Thread   │ │
│  │  ├─ Roadmap   │  │   │   Current Document   │ │   │               │ │
│  │  ├─ GTM Plan  │  │   │   or Entity View     │ │   │ > User msg    │ │
│  │  └─ Decisions │  │   │                      │ │   │               │ │
│  │               │  │   │   [Markdown/Grid/    │ │   │ < AI response │ │
│  │ Entities      │  │   │    DSL rendered]     │ │   │   + diff      │ │
│  │  ├─ People    │  │   │                      │ │   │   + evidence  │ │
│  │  ├─ Orgs      │  │   │                      │ │   │               │ │
│  │  └─ Products  │  │   │                      │ │   │ [Apply/Reject]│ │
│  │               │  │   │                      │ │   │               │ │
│  │ Evidence      │  │   └──────────────────────┘ │   └───────────────┘ │
│  │  (filtered)   │  │                            │                     │
│  └───────────────┘  │                            │                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pane Behaviors

**Left Pane (Navigation)**
- Tree view of all artifacts organized by type
- Documents, Entities, Models (financial DSLs)
- Collapsible sections
- Search/filter
- Shows "pending changes" badges when AI has proposed updates
- Evidence section (permission-gated, user's own by default)

**Center Pane (Artifact Viewer/Editor)**
- Renders the currently selected artifact
- Markdown documents → rich text with inline editing
- Tables → pivot-table-style grid (see Table Views section below)
- Entity profiles → structured card view
- Shows inline diff highlights when reviewing AI proposals
- Comment threads anchored to ranges/blocks

**Right Pane (AI Conversation)**
- Context-aware: knows what artifact is in view
- Structured responses (not chatty)
- Suggestions come with:
  - Proposed diff (preview in conversation, apply to center pane)
  - Evidence citations (expandable)
  - Confidence indicators
- Approve/reject/edit controls
- Thread history persists per artifact or globally

---

## Phase 0: Foundation (Weeks 1-4)

### 0.1 Project Scaffolding
- [ ] Initialize monorepo structure
  - `/packages/web` - React frontend
  - `/packages/core` - Shared types, filesystem abstraction
  - `/packages/server` - Backend services
  - `/packages/tables` - Table view query engine and renderer
- [ ] Set up build tooling (Vite, TypeScript, ESLint)
- [ ] Set up CI/CD pipeline
- [ ] Design system foundations (Tailwind, component library)

### 0.2 Virtual Filesystem Core
- [ ] Define filesystem abstraction interface
  ```typescript
  interface VirtualFS {
    read(path: string): Promise<FileContent>
    write(path: string, content: string): Promise<void>
    patch(path: string, diff: Diff): Promise<void>
    list(path: string): Promise<FileEntry[]>
    watch(path: string, callback: WatchCallback): Unsubscribe
    history(path: string): Promise<Commit[]>
  }
  ```
- [ ] SQLite-backed implementation (AgentFS-style)
- [ ] Git-like versioning layer (commits, diffs)
- [ ] File type registry (markdown, yaml, dsl)

### 0.3 Core Data Schemas
- [ ] Document schema (frontmatter + markdown body)
- [ ] Entity schema (type, properties, relationships, evidence)
- [ ] Evidence schema (source, content, timestamp, privacy)
- [ ] Relationship schema (subject, predicate, object, confidence, evidence)

---

## Phase 1: Core UI Shell (Weeks 5-8)

### 1.1 Three-Pane Layout
- [x] Resizable pane container component
- [x] Pane collapse/expand controls
- [x] Responsive behavior (mobile: bottom sheet for AI, tabs for nav)
- [x] Keyboard navigation between panes

### 1.2 Left Pane - Navigation
- [x] Tree view component
- [x] Artifact type sections (Documents, Entities, Models)
- [x] Search bar with fuzzy matching
- [x] Badge system for pending changes
- [x] Drag-and-drop reordering (within sections)
- [x] Context menu (rename, delete, move)

### 1.3 Center Pane - Artifact Viewer
- [ ] Markdown renderer with:
  - [ ] Frontmatter parsing (hidden but accessible)
  - [ ] Inline editing (click to edit blocks)
  - [ ] Entity mention links (auto-detected)
  - [ ] Comment anchoring (selection → comment)
- [ ] Diff view mode (side-by-side or inline)
- [ ] Loading/empty/error states

### 1.4 Right Pane - AI Conversation
- [ ] Chat message component
  - [ ] User messages
  - [ ] AI messages with structured sections
  - [ ] Diff preview blocks (syntax highlighted)
  - [ ] Evidence citation pills (expandable)
- [ ] Input area with:
  - [ ] Multi-line text input
  - [ ] Submit button / keyboard shortcut
  - [ ] Context indicator (what artifact AI sees)
- [ ] Message actions (copy, retry, expand diff)

---

## Phase 2: Document System (Weeks 9-12)

### 2.1 Document CRUD
- [ ] Create new document (type selection, naming)
- [ ] Save document (auto-save + manual)
- [ ] Delete document (with confirmation)
- [ ] Move/rename document
- [ ] Document templates (Roadmap, GTM, Decision Log)

### 2.2 Rich Markdown Editing
- [ ] Block-based editing (paragraphs, headers, lists)
- [ ] Inline formatting toolbar
- [ ] Slash commands for block types
- [ ] Tables (markdown tables rendered nicely)
- [ ] Code blocks with syntax highlighting
- [ ] Image/file embeds

### 2.3 Document Versioning
- [ ] Version history panel
- [ ] Diff between versions
- [ ] Restore previous version
- [ ] Commit messages (auto-generated or manual)

### 2.4 Comments & Threads
- [ ] Highlight text → create comment
- [ ] Comment thread UI
- [ ] Resolve/unresolve threads
- [ ] AI can participate in threads (structured replies)

---

## Phase 3: The Graph — Nouns & Verbs (Weeks 13-16)

The system maintains a typed graph with two primitives:
- **Nouns** = Entity types (Person, Organization, Project, Call, Email, etc.)
- **Verbs** = Relationship types (works_at, owns, participated_in, etc.)

This is the foundation that powers Tables, AI reasoning, and human understanding.

### 3.1 Noun System (Entity Types)

**Core noun types (built-in)**
- [ ] Person — teammates, customers, investors, candidates
- [ ] Organization — companies, teams, departments  
- [ ] Project — initiatives, features, products
- [ ] Event — calls, meetings (these are nouns, not just evidence)

**Noun type schema**
```yaml
# Stored in /types/nouns/person.yaml
noun: Person
properties:
  - name: { type: string, required: true }
  - email: { type: string }
  - title: { type: string }
  - photo: { type: image }
display:
  primary: name
  secondary: title
  avatar: photo
aliases: [people, user, contact, individual]
```

- [ ] Noun type registry
- [ ] Property definitions per noun type
- [ ] Display configuration (what shows in lists, cards)
- [ ] Alias mapping ("people" → Person, "user" → Person)

### 3.2 Verb System (Relationship Types)

**Core verb types (built-in)**
- [ ] works_at — Person → Organization
- [ ] owns — Person → Project
- [ ] reports_to — Person → Person
- [ ] participated_in — Person → Event
- [ ] member_of — Person → Organization
- [ ] client_of — Organization → Organization

**Verb type schema**
```yaml
# Stored in /types/verbs/works_at.yaml
verb: works_at
subject: Person
object: Organization
properties:
  - title: { type: string }
  - start_date: { type: date }
  - end_date: { type: date }
inverse: employs  # Organization employs Person
aliases: [employed_by, employee_of, works_for]
```

- [ ] Verb type registry
- [ ] Subject/object type constraints
- [ ] Verb properties (e.g., works_at can have title, start_date)
- [ ] Inverse verb naming (works_at ↔ employs)
- [ ] Alias mapping ("employed_by" → works_at)

### 3.3 Taxonomy Evolution

The noun/verb vocabulary emerges over time:

- [ ] AI proposes new noun types from patterns
  - "We keep seeing 'Feature' mentioned — should this be a type?"
- [ ] AI proposes new verb types from patterns
  - "People seem to 'sponsor' Projects — add this verb?"
- [ ] Alias detection and merging
  - AI notices "works_at" and "employed_by" mean the same thing
- [ ] User approve/reject/merge for proposed types
- [ ] Type promotion workflow (proposed → accepted)

### 3.4 Entity (Noun Instance) Storage

```yaml
# Stored in /entities/person/alice-smith.yaml
type: Person
id: alice-smith-uuid
properties:
  name: Alice Smith
  email: alice@acme.com
  title: VP Engineering
evidence:
  - source: email:abc123
    extracted: [name, email]
  - source: call:def456
    extracted: [title]
confidence:
  title: 0.85  # mentioned once in a call
```

- [ ] Entity file format
- [ ] Evidence linking (which sources support which properties)
- [ ] Confidence scores per property
- [ ] Entity deduplication (merge candidates)

### 3.5 Relationship (Verb Instance) Storage

```yaml
# Could be inline in entity or separate
# /relationships/works_at/alice-acme.yaml
verb: works_at
subject: person:alice-smith-uuid
object: org:acme-corp-uuid
properties:
  title: VP Engineering
  start_date: 2023-01-15
evidence:
  - source: email:abc123
    confidence: 0.9
```

- [ ] Relationship storage format
- [ ] Bidirectional indexing (find by subject or object)
- [ ] Evidence and confidence per relationship
- [ ] Temporal relationships (start/end dates)

### 3.6 Entity Profile View
- [ ] Card-based layout with sections
- [ ] Property display with confidence indicators
- [ ] Relationships section grouped by verb type
  - "works_at: Acme Corp"
  - "owns: Dashboard Project, Auth System"
  - "participated_in: 12 calls, 47 emails"
- [ ] Evidence section (expandable sources)
- [ ] Edit mode for manual corrections
- [ ] "AI is uncertain" callouts

### 3.7 Graph Visualization
- [ ] Network graph view (optional, for power users)
- [ ] Filter by noun type, verb type
- [ ] Click node → navigate to entity
- [ ] Mini-graph embedded in entity profile

### 3.8 Mentions → Relationships Pipeline
- [ ] Detect entity mentions in text (documents, evidence)
- [ ] Mentions are not relationships (just references)
- [ ] AI proposes relationships from mention patterns
  - "Alice mentioned Acme 15 times → works_at?"
- [ ] Human review for relationship promotion

---

## Phase 4: AI Integration (Weeks 17-22)

### 4.1 AI Backend Service
- [ ] LLM integration layer (Claude API)
- [ ] Prompt engineering framework
  - [ ] System prompts per context type
  - [ ] User context injection
  - [ ] Artifact context injection
- [ ] Response parsing (structured JSON)
- [ ] Streaming support

### 4.2 Context Building
- [ ] Current artifact as context
- [ ] User context doc injection
- [ ] Relevant entities extraction
- [ ] Evidence retrieval (for claims)
- [ ] Token budget management

### 4.3 Structured AI Responses
- [ ] Response schema definition
  ```typescript
  interface AIResponse {
    answer?: string
    suggestions?: Suggestion[]
    questions?: Question[]
    evidence?: EvidenceCitation[]
  }
  
  interface Suggestion {
    description: string
    diff: Diff
    confidence: number
    evidence: EvidenceCitation[]
  }
  ```
- [ ] Diff generation from natural language
- [ ] Evidence citation linking

### 4.4 Diff Application Flow
- [ ] Preview diff in conversation
- [ ] "Apply" action → diff visible in center pane
- [ ] Accept/reject/edit diff
- [ ] Commit on accept (with auto-message)

### 4.5 Proactive AI Proposals
- [ ] Background processing of new evidence
- [ ] Propose updates to relevant documents
- [ ] Notification/badge system for pending proposals
- [ ] Review queue UI

---

## Phase 5: Evidence Ingestion (Weeks 23-28)

### 5.1 Evidence Storage
- [ ] Evidence object model
- [ ] Privacy flags (private/promotable/shared)
- [ ] Source tracking (email/call/slack/manual)
- [ ] Timestamp and ordering

### 5.2 Email Integration
- [ ] OAuth connection to Gmail/Outlook
- [ ] Email sync service
- [ ] Privacy controls (labels, folders)
- [ ] Email viewer (read-only)
- [ ] "Promote to workspace" action

### 5.3 Call/Transcript Integration
- [ ] Audio file upload
- [ ] Transcription service integration
- [ ] Transcript viewer
- [ ] Extraction pipeline:
  - [ ] Entities mentioned
  - [ ] Claims made
  - [ ] Action items
  - [ ] Decisions

### 5.4 Slack Integration
- [ ] Slack app setup
- [ ] Channel selection (opt-in)
- [ ] Message action: "Add to Brain"
- [ ] Slash command: /brain [query]
- [ ] Channel digest summaries

### 5.5 Claim Extraction
- [ ] Claim data model
  ```typescript
  interface Claim {
    content: string
    entities: EntityRef[]
    source: EvidenceRef
    confidence: number
    status: 'proposed' | 'accepted' | 'rejected'
  }
  ```
- [ ] AI-powered extraction from evidence
- [ ] Review UI for proposed claims
- [ ] Claims feed entities and documents

---

## Phase 6: Table Views (Weeks 29-34)

Tables are the primary way to view structured data derived from entities and evidence. Unlike traditional spreadsheets where users manually enter data and formulas, tables here are **declarative views over the entity graph** — closer to pivot tables than Excel.

### Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Table Canvas                                                   │
│                                                                 │
│  ┌─────────┐     ┌─────────────────────────────────────────┐   │
│  │ People  │ ──► │         Q1      Q2      Q3      Q4      │   │
│  │ (rows)  │     │ Alice    3       5       2       4      │   │
│  └─────────┘     │ Bob      1       2       1       3      │   │
│                  │ Carol    4       3       5       2      │   │
│  ┌─────────┐     └─────────────────────────────────────────┘   │
│  │ Time    │ ──►   (columns)                                   │
│  │(quarter)│                                                    │
│  └─────────┘     ┌─────────┐                                   │
│                  │ Calls   │ ──► (values: count of Call        │
│                  │ (value) │      entities where participant   │
│                  └─────────┘      = row person, date in col)   │
└─────────────────────────────────────────────────────────────────┘
```

**The key insight**: Users drop **nouns** onto row/column/value slots. The system knows the **verbs** that connect them (Person → participated_in → Call) and auto-generates the query. No manual joins — the graph does the work.

### 6.1 Table Definition Schema
- [ ] Table artifact type in filesystem
  ```yaml
  type: table
  name: "Calls by Person by Quarter"
  
  rows:
    source: Person
    filter: { relationship: "member_of", target: "Sales Team" }
  
  columns:
    source: Time
    granularity: quarter
    range: { start: "2024-01-01", end: "2024-12-31" }
  
  values:
    entity_type: Call
    aggregation: count
    # System infers: Call.participants includes row.Person 
    #                AND Call.date within col.Time
  
  # Optional: manual overrides (like Excel overrides in a pivot)
  overrides:
    - row: "entity:alice-uuid"
      column: "2024-Q2"
      value: 6  # Manual correction
      note: "Includes off-system calls"
  ```

### 6.2 Verb-Aware Query Engine
- [ ] Graph traversal using verb definitions
- [ ] Automatic verb path discovery
  - Given nouns (Person, Call), find verb: Person → participated_in → Call
  - Multi-hop: Person → participated_in → Call → occurred_on → Date
- [ ] Verb path ambiguity resolution
  - If multiple verbs connect the same nouns, prompt user or use most common
- [ ] Aggregation functions (count, sum, avg, min, max, list)
- [ ] Filter expressions using noun properties
- [ ] Null/missing data handling

### 6.3 Table Builder UI
- [ ] Drop zones for rows, columns, values
- [ ] Noun type picker (drag from left pane or dropdown)
- [ ] Noun instance picker (specific entities or filtered sets)
- [ ] Verb path display (show how nouns connect)
- [ ] Time dimension helpers (day/week/month/quarter/year)
- [ ] Aggregation selector
- [ ] Filter builder (using noun properties)
- [ ] Preview as you build

### 6.4 Table Renderer
- [ ] Grid component (virtualized for large tables)
- [ ] Row/column headers from entity names
- [ ] Cell rendering by data type
- [ ] Sorting (click headers)
- [ ] Column resizing
- [ ] Freeze rows/columns
- [ ] Conditional formatting (color scales, thresholds)

### 6.5 Interactivity
- [ ] Click cell → see underlying entities (drill-down)
- [ ] Click cell → navigate to entity
- [ ] Cell override → stored in table definition
- [ ] Add calculated columns (formulas over other columns)
- [ ] Add calculated rows (totals, averages)

### 6.6 Common Table Patterns (Templates)

**Activity over Time**
- Rows: People / Organizations / Projects
- Columns: Time periods
- Values: Count of some activity entity (Calls, Emails, Commits)

**Relationship Matrix**
- Rows: Entity set A (e.g., Sales reps)
- Columns: Entity set B (e.g., Accounts)
- Values: Relationship strength, last contact, deal value

**Financial Model**
- Rows: Line items (Revenue, COGS, Expenses — as entities or manual)
- Columns: Time periods
- Values: Amounts (from transactions, or manual assumptions)
- Calculated rows: Subtotals, ratios

**Pipeline/Funnel**
- Rows: Stages
- Columns: Time periods or segments
- Values: Count or sum of deals/opportunities

### 6.7 AI + Tables
- [ ] "Create a table showing X" → AI builds table definition
- [ ] AI suggests tables based on available entities
- [ ] AI explains what a table is showing
- [ ] AI proposes new rows/columns based on context
- [ ] Natural language filtering ("show only enterprise accounts")

### 6.8 Table ↔ Document Integration
- [ ] Embed table in markdown document (live reference)
- [ ] Table as citation source (claims backed by table data)
- [ ] Export table to markdown/CSV

---

## Phase 7: User & Org Context (Weeks 35-38)

### 7.1 User Context Document
- [ ] Template for user context
- [ ] Settings UI to edit context
- [ ] AI reads before every interaction
- [ ] Inference suggestions (AI proposes updates)

### 7.2 Org Structure
- [ ] Org chart document format
- [ ] Visual org chart view
- [ ] Reporting lines
- [ ] Team groupings
- [ ] Permissions derivation (later)

### 7.3 Onboarding Flow
- [ ] Initial user context setup
- [ ] Org context setup (for admins)
- [ ] Sample documents creation
- [ ] Guided tour

---

## Phase 8: Sync & Collaboration (Weeks 39-44)

### 8.1 Cloud Sync
- [ ] Sync protocol design
- [ ] Conflict resolution strategy (CRDT or OT)
- [ ] Offline support
- [ ] Sync status indicators

### 8.2 Multi-user
- [ ] User accounts
- [ ] Workspace membership
- [ ] Presence indicators (who's viewing)
- [ ] Real-time updates (WebSocket)

### 8.3 Permissions
- [ ] Document-level permissions
- [ ] Evidence privacy enforcement
- [ ] Role-based access (admin, member, viewer)
- [ ] Share links (read-only)

### 8.4 Activity & Audit
- [ ] Activity feed
- [ ] Change attribution
- [ ] Audit log (who changed what when)

---

## Phase 9: Polish & Launch (Weeks 45-48)

### 9.1 Performance
- [ ] Lazy loading for large workspaces
- [ ] Search indexing
- [ ] Caching strategy
- [ ] Bundle optimization

### 9.2 Mobile
- [ ] Responsive layouts complete
- [ ] Mobile-specific interactions
- [ ] Push notifications for approvals
- [ ] Quick review flows

### 9.3 Onboarding & Help
- [ ] Interactive tutorials
- [ ] Contextual help
- [ ] Documentation site
- [ ] Video walkthroughs

### 9.4 Launch Prep
- [ ] Beta user program
- [ ] Feedback collection
- [ ] Bug bash
- [ ] Launch checklist

---

## Technical Architecture

### Frontend Stack
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** or **Jotai** for state management
- **TipTap** or **Lexical** for rich text editing
- **React Query** for server state
- **Vite** for build tooling

### Backend Stack
- **Node.js** with TypeScript (or Rust for performance-critical parts)
- **SQLite** for filesystem storage (per workspace)
- **PostgreSQL** for user/workspace metadata
- **Redis** for real-time pub/sub
- **S3** for evidence storage (audio, attachments)

### AI Stack
- **Claude API** for LLM
- **Embeddings** for semantic search
- **Background job queue** for ingestion/extraction

### Infrastructure
- **Docker** for local dev and deployment
- **Fly.io** or **Railway** for initial hosting
- **Cloudflare** for edge/CDN

---

## Key Design Decisions to Make

1. **Diff format**: Use unified diff, custom patch format, or CRDT operations?
2. **Entity resolution**: How aggressive should auto-linking be?
3. **AI autonomy level**: How much can AI do without explicit approval?
4. **Sync granularity**: File-level, block-level, or character-level?
5. **Table query engine**: Build custom graph query or use existing (Datalog, GraphQL)?
6. **Relationship inference**: How much should the system auto-discover join paths?
7. **Mobile approach**: Responsive web or native apps?

---

## Success Metrics

- **Adoption**: Weekly active users, documents created
- **Engagement**: AI suggestions proposed, suggestions accepted
- **Retention**: Weekly retention, time in app
- **Quality**: Evidence → knowledge conversion rate
- **Collaboration**: Comments, shared documents, multi-user edits

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI hallucinations corrupt knowledge | Mandatory human review, confidence scores, evidence requirement |
| Complexity overwhelms users | Progressive disclosure, excellent defaults, templates |
| Sync conflicts cause data loss | CRDT foundation, version history, easy restore |
| Evidence privacy violations | Default private, explicit promotion, permission audits |
| Scope creep | Strict phase gates, "not this" list in README |
