import { getTursoClient } from "./turso";

// =============================================================================
// NOUNS (Entity Types)
// =============================================================================
// Per BUILD_PLAN Phase 3: Nouns are the things in your company's world.
// Each noun instance is a lightweight, evolving profile that can be:
// - Sparse (not all fields required)
// - Editable (humans can correct)
// - Confidence-scored (AI marks uncertainty)
// - Evidence-backed (claims cite sources)

export type EntityType = "person" | "organization" | "project" | "event";

// Property with optional confidence and evidence
export type PropertyValue = {
  value: unknown;
  confidence?: number; // 0-1
  evidence_ids?: string[]; // Which sources support this property
};

export type Entity = {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

// =============================================================================
// VERBS (Relationship Types)
// =============================================================================
// Per BUILD_PLAN Phase 3: Verbs connect nouns with meaning.
// - Named in plain English (AI and humans both understand)
// - Typed (constrain which nouns can connect)
// - Directional (subject → object)
// - Evidence-backed (where did we learn this?)

export type RelationshipType =
  | "works_at" // Person → Organization
  | "owns" // Person → Project
  | "participated_in" // Person → Event
  | "mentioned_in" // Entity → Document/Evidence
  | "decided" // Person → Decision (future)
  | "reports_to" // Person → Person
  | "client_of" // Organization → Organization
  | "investor_in" // Organization/Person → Organization
  | "founded" // Person → Organization
  | "member_of"; // Person → Organization/Project

// Verb metadata for display and validation
export const VERB_METADATA: Record<
  RelationshipType,
  {
    label: string;
    inverse?: string; // The inverse verb name
    subjectTypes: EntityType[];
    objectTypes: EntityType[];
  }
> = {
  works_at: {
    label: "works at",
    inverse: "employs",
    subjectTypes: ["person"],
    objectTypes: ["organization"],
  },
  owns: {
    label: "owns",
    inverse: "owned_by",
    subjectTypes: ["person"],
    objectTypes: ["project"],
  },
  participated_in: {
    label: "participated in",
    subjectTypes: ["person"],
    objectTypes: ["event"],
  },
  mentioned_in: {
    label: "mentioned in",
    subjectTypes: ["person", "organization", "project"],
    objectTypes: ["event"],
  },
  decided: {
    label: "decided",
    subjectTypes: ["person"],
    objectTypes: ["project"], // Will be "decision" type later
  },
  reports_to: {
    label: "reports to",
    inverse: "manages",
    subjectTypes: ["person"],
    objectTypes: ["person"],
  },
  client_of: {
    label: "is client of",
    inverse: "has_client",
    subjectTypes: ["organization"],
    objectTypes: ["organization"],
  },
  investor_in: {
    label: "invested in",
    inverse: "funded_by",
    subjectTypes: ["person", "organization"],
    objectTypes: ["organization"],
  },
  founded: {
    label: "founded",
    inverse: "founded_by",
    subjectTypes: ["person"],
    objectTypes: ["organization"],
  },
  member_of: {
    label: "member of",
    inverse: "has_member",
    subjectTypes: ["person"],
    objectTypes: ["organization", "project"],
  },
};

export type Relationship = {
  id: string;
  type: RelationshipType;
  subject_id: string;
  object_id: string;
  properties: Record<string, unknown>;
  evidence_ids: string[]; // Links to evidence (documents, messages, transcripts)
  created_at: number;
  updated_at: number;
};

// Initialize entity tables
export async function initEntityTables(): Promise<void> {
  const db = getTursoClient();

  // Entities table (nouns)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Index for searching by type
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)
  `);

  // Relationships table (verbs)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1.0,
      evidence_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES entities(id),
      FOREIGN KEY (object_id) REFERENCES entities(id)
    )
  `);

  // Indexes for relationship queries
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_relationships_subject ON relationships(subject_id)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_relationships_object ON relationships(object_id)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)
  `);

  console.log("Entity tables initialized");
}

// Entity CRUD operations
export async function getAllEntities(): Promise<Entity[]> {
  const db = getTursoClient();
  const result = await db.execute("SELECT * FROM entities ORDER BY name");
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as EntityType,
    name: row.name as string,
    properties: JSON.parse(row.properties as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

export async function getEntitiesByType(type: EntityType): Promise<Entity[]> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM entities WHERE type = ? ORDER BY name",
    args: [type],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as EntityType,
    name: row.name as string,
    properties: JSON.parse(row.properties as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

export async function getEntity(id: string): Promise<Entity | null> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM entities WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    type: row.type as EntityType,
    name: row.name as string,
    properties: JSON.parse(row.properties as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

export async function createEntity(
  type: EntityType,
  name: string,
  properties: Record<string, unknown> = {},
  confidence: number = 1.0,
): Promise<Entity> {
  const db = getTursoClient();
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO entities (id, type, name, properties, confidence, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, type, name, JSON.stringify(properties), confidence, now, now],
  });

  return {
    id,
    type,
    name,
    properties,
    created_at: now,
    updated_at: now,
  };
}

export async function updateEntity(
  id: string,
  updates: {
    name?: string;
    properties?: Record<string, unknown>;
  },
): Promise<void> {
  const db = getTursoClient();
  const entity = await getEntity(id);
  if (!entity) throw new Error(`Entity not found: ${id}`);

  const now = Date.now();
  const newName = updates.name ?? entity.name;
  const newProperties = updates.properties ?? entity.properties;

  await db.execute({
    sql: "UPDATE entities SET name = ?, properties = ?, updated_at = ? WHERE id = ?",
    args: [newName, JSON.stringify(newProperties), now, id],
  });
}

export async function deleteEntity(id: string): Promise<void> {
  const db = getTursoClient();
  // Delete relationships first
  await db.execute({
    sql: "DELETE FROM relationships WHERE subject_id = ? OR object_id = ?",
    args: [id, id],
  });
  await db.execute({
    sql: "DELETE FROM entities WHERE id = ?",
    args: [id],
  });
}

// Relationship CRUD operations
export async function getAllRelationships(): Promise<Relationship[]> {
  const db = getTursoClient();
  const result = await db.execute("SELECT * FROM relationships");
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as RelationshipType,
    subject_id: row.subject_id as string,
    object_id: row.object_id as string,
    properties: JSON.parse(row.properties as string),
    evidence_ids: JSON.parse(row.evidence_ids as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

export async function getRelationshipsForEntity(
  entityId: string,
): Promise<Relationship[]> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM relationships WHERE subject_id = ? OR object_id = ?",
    args: [entityId, entityId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as RelationshipType,
    subject_id: row.subject_id as string,
    object_id: row.object_id as string,
    properties: JSON.parse(row.properties as string),
    evidence_ids: JSON.parse(row.evidence_ids as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

export async function createRelationship(
  type: RelationshipType,
  subjectId: string,
  objectId: string,
  properties: Record<string, unknown> = {},
  evidenceIds: string[] = [],
): Promise<Relationship> {
  const db = getTursoClient();
  const id = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO relationships (id, type, subject_id, object_id, properties, evidence_ids, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      type,
      subjectId,
      objectId,
      JSON.stringify(properties),
      JSON.stringify(evidenceIds),
      now,
      now,
    ],
  });

  return {
    id,
    type,
    subject_id: subjectId,
    object_id: objectId,
    properties,
    evidence_ids: evidenceIds,
    created_at: now,
    updated_at: now,
  };
}

export async function deleteRelationship(id: string): Promise<void> {
  const db = getTursoClient();
  await db.execute({
    sql: "DELETE FROM relationships WHERE id = ?",
    args: [id],
  });
}

// Search entities by name
export async function searchEntities(query: string): Promise<Entity[]> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM entities WHERE name LIKE ? ORDER BY name LIMIT 20",
    args: [`%${query}%`],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as EntityType,
    name: row.name as string,
    properties: JSON.parse(row.properties as string),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}
