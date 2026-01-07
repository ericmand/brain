import { create } from "zustand";
import * as turso from "../lib/turso";

export type Document = {
  id: string;
  path: string;
  title: string;
  content: string;
  frontmatter: Record<string, string>;
  frontmatterRaw: string | null;
  updatedAt: number;
};

export type PendingChange = {
  id: string;
  documentId: string; // "new" for create operations
  operation: "insert" | "replace" | "delete" | "create";
  target: string; // where to apply the change, or for create: the new document title
  content: string; // the new content
  description: string;
  status: "pending" | "applied" | "dismissed";
};

type DocumentStore = {
  documents: Record<string, Document>;
  currentDocumentId: string | null;
  lastCreatedDocumentId: string | null;
  pendingChanges: PendingChange[];
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setCurrentDocument: (documentId: string | null) => void;
  updateDocument: (documentId: string, content: string) => void;
  getCurrentDocument: () => Document | null;
  getDocument: (documentId: string) => Document | null;
  getAllDocuments: () => Document[];
  createDocument: (title: string, content: string) => Promise<string>;
  clearLastCreatedDocumentId: () => void;
  deleteDocument: (documentId: string) => Promise<void>;
  updateDocumentMetadata: (
    documentId: string,
    updates: { title?: string; path?: string },
  ) => Promise<void>;

  // Multi-change flow
  setPendingChanges: (changes: Omit<PendingChange, "id" | "status">[]) => void;
  applyChange: (changeId: string) => void;
  dismissChange: (changeId: string) => void;
  applyAllChanges: () => void;
  dismissAllChanges: () => void;
  getChangesForDocument: (documentId: string) => PendingChange[];
  hasPendingChanges: () => boolean;
};

type FrontmatterResult = {
  body: string;
  frontmatter: Record<string, string>;
  frontmatterRaw: string | null;
};

function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith("---")) {
    return { body: content, frontmatter: {}, frontmatterRaw: null };
  }

  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) {
    return { body: content, frontmatter: {}, frontmatterRaw: null };
  }

  const raw = match[1];
  const frontmatter: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) frontmatter[key] = value;
  }

  return {
    body: content.slice(match[0].length),
    frontmatter,
    frontmatterRaw: raw,
  };
}

function serializeDocumentContent(
  frontmatterRaw: string | null,
  body: string,
): string {
  if (!frontmatterRaw) return body;
  const normalizedBody = body.startsWith("\n") ? body.slice(1) : body;
  return `---\n${frontmatterRaw}\n---\n${normalizedBody}`;
}

// Helper to find insertion point in HTML content
function findInsertionPoint(content: string, target: string): number {
  const lowerTarget = target.toLowerCase();

  if (lowerTarget.includes("after")) {
    const searchTerm = lowerTarget.replace("after", "").trim();
    const headingRegex = /<h[1-6][^>]*>[^<]*<\/h[1-6]>/gi;
    let match;
    let lastMatchEnd = -1;

    while ((match = headingRegex.exec(content)) !== null) {
      if (match[0].toLowerCase().includes(searchTerm)) {
        lastMatchEnd = match.index + match[0].length;
        const headingLevel = match[0].charAt(2);
        const nextHeadingRegex = new RegExp(
          `<h[1-${headingLevel}][^>]*>`,
          "gi",
        );
        nextHeadingRegex.lastIndex = lastMatchEnd;
        const nextMatch = nextHeadingRegex.exec(content);
        if (nextMatch) {
          return nextMatch.index;
        }
        return content.length;
      }
    }
  }

  if (lowerTarget.includes("before")) {
    const searchTerm = lowerTarget.replace("before", "").trim();
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(searchTerm);
    if (index !== -1) {
      const beforeContent = content.substring(0, index);
      const lastTagStart = beforeContent.lastIndexOf("<");
      return lastTagStart !== -1 ? lastTagStart : index;
    }
  }

  if (lowerTarget.includes("end")) {
    return content.length;
  }

  if (lowerTarget.includes("beginning") || lowerTarget.includes("start")) {
    const firstHeadingEnd = content.search(/<\/h[1-6]>/i);
    if (firstHeadingEnd !== -1) {
      return firstHeadingEnd + 5;
    }
    return 0;
  }

  return content.length;
}

// Helper to find and replace content
function findAndReplace(
  content: string,
  target: string,
  newContent: string,
): string {
  const lowerTarget = target.toLowerCase();

  if (lowerTarget.includes("replace") || lowerTarget.includes("delete")) {
    const searchTerm = lowerTarget
      .replace("replace", "")
      .replace("delete", "")
      .replace("the", "")
      .trim();

    const headingRegex = /<h[1-6][^>]*>[^<]*<\/h[1-6]>/gi;
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      if (match[0].toLowerCase().includes(searchTerm)) {
        const sectionStart = match.index;
        const headingLevel = match[0].charAt(2);
        const nextHeadingRegex = new RegExp(
          `<h[1-${headingLevel}][^>]*>`,
          "gi",
        );
        nextHeadingRegex.lastIndex = sectionStart + match[0].length;
        const nextMatch = nextHeadingRegex.exec(content);
        const sectionEnd = nextMatch ? nextMatch.index : content.length;

        return (
          content.substring(0, sectionStart) +
          newContent +
          content.substring(sectionEnd)
        );
      }
    }
  }

  return content + "\n" + newContent;
}

// Apply a single change to content
function applyChangeToContent(content: string, change: PendingChange): string {
  switch (change.operation) {
    case "insert": {
      const insertPoint = findInsertionPoint(content, change.target);
      return (
        content.substring(0, insertPoint) +
        "\n" +
        change.content +
        content.substring(insertPoint)
      );
    }
    case "replace": {
      return findAndReplace(content, change.target, change.content);
    }
    case "delete": {
      return findAndReplace(content, change.target, "");
    }
    default:
      return content + "\n" + change.content;
  }
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: {},
  currentDocumentId: null,
  lastCreatedDocumentId: null,
  pendingChanges: [],
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      set({ isLoading: true });

      // Initialize database
      await turso.initDatabase();

      // Load all documents
      const docs = await turso.getAllDocuments();
      const documentsMap: Record<string, Document> = {};

      for (const doc of docs) {
        const parsed = parseFrontmatter(doc.content);
        documentsMap[doc.id] = {
          id: doc.id,
          path: doc.path,
          title: doc.title,
          content: parsed.body,
          frontmatter: parsed.frontmatter,
          frontmatterRaw: parsed.frontmatterRaw,
          updatedAt: doc.updated_at,
        };
      }

      set({
        documents: documentsMap,
        currentDocumentId: docs.length > 0 ? docs[0].id : null,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to initialize document store:", error);
      set({ isLoading: false });
    }
  },

  setCurrentDocument: (documentId) => {
    set({ currentDocumentId: documentId });
  },

  updateDocument: async (documentId, content) => {
    const existing = get().documents[documentId];
    const parsed = parseFrontmatter(content);
    const hasNewFrontmatter = parsed.frontmatterRaw !== null;
    const frontmatterRaw =
      parsed.frontmatterRaw ?? existing?.frontmatterRaw ?? null;
    const frontmatter =
      hasNewFrontmatter && parsed.frontmatterRaw
        ? parsed.frontmatter
        : existing?.frontmatter || {};
    const body = hasNewFrontmatter ? parsed.body : content;
    const serialized = serializeDocumentContent(frontmatterRaw, body);

    // Update local state immediately
    set((state) => ({
      documents: {
        ...state.documents,
        [documentId]: {
          ...state.documents[documentId],
          content: body,
          frontmatter,
          frontmatterRaw,
          updatedAt: Date.now(),
        },
      },
    }));

    // Persist to Turso
    try {
      await turso.updateDocument(documentId, serialized);
    } catch (error) {
      console.error("Failed to persist document update:", error);
    }
  },

  getCurrentDocument: () => {
    const state = get();
    if (!state.currentDocumentId) return null;
    return state.documents[state.currentDocumentId] || null;
  },

  getDocument: (documentId) => {
    return get().documents[documentId] || null;
  },

  getAllDocuments: () => {
    return Object.values(get().documents);
  },

  createDocument: async (title, content) => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const path = `/docs/${slug}.md`;
    const parsed = parseFrontmatter(content);
    const serialized = serializeDocumentContent(
      parsed.frontmatterRaw,
      parsed.body,
    );

    const newDoc: Document = {
      id,
      path,
      title,
      content: parsed.body,
      frontmatter: parsed.frontmatter,
      frontmatterRaw: parsed.frontmatterRaw,
      updatedAt: Date.now(),
    };

    // Update local state
    set((state) => ({
      documents: { ...state.documents, [id]: newDoc },
      currentDocumentId: id,
      lastCreatedDocumentId: id,
    }));

    // Persist to Turso
    try {
      await turso.createDocument(id, path, title, serialized);
    } catch (error) {
      console.error("Failed to persist new document:", error);
    }

    return id;
  },

  clearLastCreatedDocumentId: () => {
    set({ lastCreatedDocumentId: null });
  },

  deleteDocument: async (documentId) => {
    set((state) => {
      const rest = { ...state.documents };
      delete rest[documentId];
      return {
        documents: rest,
        currentDocumentId:
          state.currentDocumentId === documentId
            ? Object.keys(rest)[0] || null
            : state.currentDocumentId,
      };
    });

    try {
      await turso.deleteDocument(documentId);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  },

  updateDocumentMetadata: async (documentId, updates) => {
    set((state) => {
      const doc = state.documents[documentId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [documentId]: {
            ...doc,
            ...updates,
            updatedAt: Date.now(),
          },
        },
      };
    });

    try {
      await turso.updateDocumentMetadata(documentId, updates);
    } catch (error) {
      console.error("Failed to update document metadata:", error);
    }
  },

  setPendingChanges: (changes) => {
    const pendingChanges: PendingChange[] = changes.map((change, index) => ({
      ...change,
      id: `change-${Date.now()}-${index}`,
      status: "pending" as const,
    }));
    set({ pendingChanges });
  },

  applyChange: (changeId) => {
    const state = get();
    const change = state.pendingChanges.find((c) => c.id === changeId);
    if (!change || change.status !== "pending") return;

    if (change.operation === "create" || change.documentId === "new") {
      get().createDocument(change.target, change.content);
    } else if (change.operation === "delete") {
      get().deleteDocument(change.documentId);
    } else {
      const doc = state.documents[change.documentId];
      if (doc) {
        const newContent = applyChangeToContent(doc.content, change);
        get().updateDocument(change.documentId, newContent);
      }
    }

    set((s) => ({
      pendingChanges: s.pendingChanges.map((c) =>
        c.id === changeId ? { ...c, status: "applied" as const } : c,
      ),
    }));
  },

  dismissChange: (changeId) => {
    set((state) => ({
      pendingChanges: state.pendingChanges.map((c) =>
        c.id === changeId ? { ...c, status: "dismissed" as const } : c,
      ),
    }));
  },

  applyAllChanges: () => {
    const state = get();
    state.pendingChanges
      .filter((c) => c.status === "pending")
      .forEach((c) => get().applyChange(c.id));
  },

  dismissAllChanges: () => {
    set((state) => ({
      pendingChanges: state.pendingChanges.map((c) =>
        c.status === "pending" ? { ...c, status: "dismissed" as const } : c,
      ),
    }));
  },

  getChangesForDocument: (documentId) => {
    return get().pendingChanges.filter(
      (c) => c.documentId === documentId && c.status === "pending",
    );
  },

  hasPendingChanges: () => {
    return get().pendingChanges.some((c) => c.status === "pending");
  },
}));
