import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDocumentStore, type Document } from "../../stores/documentStore";
import { useEntityStore } from "../../stores/entityStore";
import type { Entity } from "../../lib/entities";
import {
  useTranscriptStore,
  type Transcript,
} from "../../stores/transcriptStore";

// Type-safe filter to remove undefined/null values
function isDefined<T>(value: T | undefined | null): value is T {
  return value != null;
}

type ConvexChange = {
  _id: Id<"changes">;
  documentId: string;
  operation: "insert" | "replace" | "delete" | "create";
  target: string;
  content?: string;
  description: string;
};

type TreeNode = {
  id: string;
  name: string;
  type: "folder" | "document" | "entity" | "transcript";
  documentId?: string;
  entityId?: string;
  transcriptId?: string;
  children?: TreeNode[];
};

function TreeItem({
  node,
  depth = 0,
  onSelectDocument,
  onSelectEntity,
  onSelectTranscript,
  onAddDocument,
  selectedDocumentId,
  selectedEntityId,
  selectedTranscriptId,
  pendingChanges,
  badgeCount,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  parentId,
}: {
  node: TreeNode;
  depth?: number;
  onSelectDocument: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onSelectTranscript: (id: string) => void;
  onAddDocument?: () => void;
  selectedDocumentId: string | null;
  selectedEntityId: string | null;
  selectedTranscriptId: string | null;
  pendingChanges: ConvexChange[];
  badgeCount?: number;
  onContextMenu?: (event: React.MouseEvent, node: TreeNode) => void;
  draggable?: boolean;
  onDragStart?: (
    event: React.DragEvent,
    node: TreeNode,
    parentId?: string,
  ) => void;
  onDragOver?: (event: React.DragEvent, node: TreeNode) => void;
  onDrop?: (event: React.DragEvent, node: TreeNode, parentId?: string) => void;
  parentId?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isDraggable =
    draggable && !hasChildren && !!(node.documentId || node.entityId || node.transcriptId);
  const isSelected =
    node.documentId === selectedDocumentId ||
    node.entityId === selectedEntityId ||
    node.transcriptId === selectedTranscriptId;
  const isSection = node.type === "folder" && depth === 0;

  // Check for pending changes on this document
  const docChanges = pendingChanges.filter(
    (c) => c.documentId === node.documentId,
  );
  const hasDelete = docChanges.some((c) => c.operation === "delete");
  const hasOtherChanges = docChanges.some((c) => c.operation !== "delete");
  const resolvedBadgeCount =
    badgeCount ?? (node.documentId ? docChanges.length : undefined);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else if (node.documentId) {
      onSelectDocument(node.documentId);
    } else if (node.entityId) {
      onSelectEntity(node.entityId);
    } else if (node.transcriptId) {
      onSelectTranscript(node.transcriptId);
    }
  };

  // Top-level sections render as headers
  if (isSection) {
    const showAddButton = node.id === "docs" && onAddDocument;
    return (
      <div className="mb-3">
        <div
          className="px-2 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-between"
          onClick={handleClick}
        >
          <span className="flex items-center gap-2">
            {node.name}
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                {badgeCount}
              </span>
            )}
          </span>
          {showAddButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddDocument();
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              title="New Document"
            >
              +
            </button>
          )}
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentId={node.id}
                onSelectDocument={onSelectDocument}
                onSelectEntity={onSelectEntity}
                onSelectTranscript={onSelectTranscript}
                onAddDocument={onAddDocument}
                selectedDocumentId={selectedDocumentId}
                selectedEntityId={selectedEntityId}
                selectedTranscriptId={selectedTranscriptId}
                pendingChanges={pendingChanges}
                onContextMenu={onContextMenu}
                draggable={draggable}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Sub-folders render as collapsible groups
  if (hasChildren) {
    return (
      <div className="mb-1">
        <div
          className="px-2 py-1 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={handleClick}
        >
          {node.name}
        </div>
        {isOpen && (
          <div>
            {node.children!.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentId={node.id}
                onSelectDocument={onSelectDocument}
                onSelectEntity={onSelectEntity}
                onSelectTranscript={onSelectTranscript}
                onAddDocument={onAddDocument}
                selectedDocumentId={selectedDocumentId}
                selectedEntityId={selectedEntityId}
                selectedTranscriptId={selectedTranscriptId}
                pendingChanges={pendingChanges}
                onContextMenu={onContextMenu}
                draggable={draggable}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf items (documents, entities)
  return (
    <div
      className={`
        px-2 py-1 cursor-pointer rounded text-sm flex items-center justify-between
        ${
          hasDelete
            ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 line-through"
            : isSelected
              ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        }
      `}
      style={{ paddingLeft: depth * 12 + 8 }}
      onClick={handleClick}
      onContextMenu={(event) => onContextMenu?.(event, node)}
      draggable={isDraggable}
      onDragStart={(event) => onDragStart?.(event, node, parentId)}
      onDragOver={(event) => onDragOver?.(event, node)}
      onDrop={(event) => onDrop?.(event, node, parentId)}
    >
      <span>{node.name}</span>
      <div className="flex items-center gap-2">
        {resolvedBadgeCount !== undefined && resolvedBadgeCount > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
            {resolvedBadgeCount}
          </span>
        )}
        {hasOtherChanges && !hasDelete && (
          <span
            className="w-2 h-2 rounded-full bg-amber-500"
            title="Pending changes"
          />
        )}
      </div>
    </div>
  );
}

export function LeftPane({ onCollapse }: { onCollapse?: () => void }) {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);
  const [orderBySection, setOrderBySection] = useState<
    Record<string, string[]>
  >({});
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    parentId: string;
  } | null>(null);
  const {
    documents,
    currentDocumentId,
    setCurrentDocument,
    createDocument,
    updateDocumentMetadata,
    deleteDocument,
  } = useDocumentStore();
  const {
    currentEntityId,
    setCurrentEntity,
    getEntitiesByType,
    initialize: initializeEntities,
    isInitialized: entitiesInitialized,
    updateEntity,
    deleteEntity,
  } = useEntityStore();
  const {
    transcripts,
    currentTranscriptId,
    setCurrentTranscript,
    initialize: initializeTranscripts,
    isInitialized: transcriptsInitialized,
  } = useTranscriptStore();

  const getOrCreateSession = useMutation(api.sessions.getOrCreate);

  // Wrapper to clear other selections when selecting a document
  const handleSelectDocument = (docId: string) => {
    setCurrentEntity(null);
    setCurrentTranscript(null);
    setCurrentDocument(docId);
  };

  // Wrapper to clear other selections when selecting an entity
  const handleSelectEntity = (entityId: string) => {
    setCurrentDocument(null);
    setCurrentTranscript(null);
    setCurrentEntity(entityId);
  };

  // Wrapper to clear other selections when selecting a transcript
  const handleSelectTranscript = (transcriptId: string) => {
    setCurrentDocument(null);
    setCurrentEntity(null);
    setCurrentTranscript(transcriptId);
  };

  // Create a new document
  const handleNewDocument = async () => {
    const baseTitle = "Untitled";
    const existingTitles = new Set(
      Object.values(documents).map((doc) => doc.title),
    );
    let title = baseTitle;
    let suffix = 2;

    while (existingTitles.has(title)) {
      title = `${baseTitle} ${suffix}`;
      suffix += 1;
    }

    setCurrentEntity(null);
    setCurrentTranscript(null);
    await createDocument(title, `<h1>${title}</h1>\n<p></p>`);
  };

  // Initialize entity store
  useEffect(() => {
    if (!entitiesInitialized) {
      initializeEntities();
    }
  }, [entitiesInitialized, initializeEntities]);

  // Initialize transcript store
  useEffect(() => {
    if (!transcriptsInitialized) {
      initializeTranscripts();
    }
  }, [transcriptsInitialized, initializeTranscripts]);

  useEffect(() => {
    if (!sessionId) {
      getOrCreateSession({ contextType: "global" }).then(setSessionId);
    }
  }, [sessionId, getOrCreateSession]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [contextMenu]);

  // Query pending changes from Convex
  const pendingChanges = useQuery(
    api.messages.getPendingChanges,
    sessionId ? { sessionId } : "skip",
  ) as ConvexChange[] | undefined;

  const query = searchQuery.trim().toLowerCase();
  const fuzzyMatch = (value: string, needle: string) => {
    if (!needle) return true;
    let index = 0;
    const target = value.toLowerCase();
    for (const char of needle) {
      index = target.indexOf(char, index);
      if (index === -1) return false;
      index += 1;
    }
    return true;
  };

  // Check for pending "create" operations
  const pendingCreates = (pendingChanges || []).filter(
    (c) => c.operation === "create" || c.documentId === "new",
  );
  const filteredPendingCreates = pendingCreates.filter((change) =>
    fuzzyMatch(change.target, query),
  );

  // Get entities by type
  const people = getEntitiesByType("person");
  const organizations = getEntitiesByType("organization");
  const projects = getEntitiesByType("project");
  const events = getEntitiesByType("event");
  const transcriptList = Object.values(transcripts);

  const pendingByDocument = (pendingChanges || []).reduce(
    (acc, change) => {
      if (change.documentId && change.documentId !== "new") {
        acc[change.documentId] = (acc[change.documentId] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const syncOrder = (sectionId: string, items: { id: string }[]) => {
    setOrderBySection((prev) => {
      const current = prev[sectionId] || [];
      const next = current.filter((id) => items.some((item) => item.id === id));
      for (const item of items) {
        if (!next.includes(item.id)) {
          next.push(item.id);
        }
      }
      if (
        next.length === current.length &&
        next.every((id, index) => id === current[index])
      ) {
        return prev;
      }
      return { ...prev, [sectionId]: next };
    });
  };

  useEffect(() => {
    syncOrder("docs", Object.values(documents));
  }, [documents]);

  useEffect(() => {
    syncOrder("transcripts", transcriptList);
  }, [transcriptList]);

  useEffect(() => {
    syncOrder("people", people);
  }, [people]);

  useEffect(() => {
    syncOrder("orgs", organizations);
  }, [organizations]);

  useEffect(() => {
    syncOrder("projects", projects);
  }, [projects]);

  useEffect(() => {
    syncOrder("events", events);
  }, [events]);

  const sortedDocuments = (orderBySection.docs || Object.keys(documents))
    .map((id) => documents[id])
    .filter(Boolean)
    .filter((doc) => fuzzyMatch(doc.title, query));
  const sortedTranscripts = (
    orderBySection.transcripts || transcriptList.map((t) => t.id)
  )
    .map((id) => transcripts[id])
    .filter(Boolean)
    .filter((transcript) => fuzzyMatch(transcript.title, query));
  const sortedPeople = (orderBySection.people || people.map((p) => p.id))
    .map((id) => people.find((p) => p.id === id))
    .filter((entity): entity is NonNullable<typeof entity> => entity != null)
    .filter((entity) => fuzzyMatch(entity.name, query));
  const sortedOrganizations = (
    orderBySection.orgs || organizations.map((o) => o.id)
  )
    .map((id) => organizations.find((o) => o.id === id))
    .filter((entity): entity is NonNullable<typeof entity> => entity != null)
    .filter((entity) => fuzzyMatch(entity.name, query));
  const sortedProjects = (
    orderBySection.projects || projects.map((p) => p.id)
  )
    .map((id) => projects.find((p) => p.id === id))
    .filter((entity): entity is NonNullable<typeof entity> => entity != null)
    .filter((entity) => fuzzyMatch(entity.name, query));
  const sortedEvents = (orderBySection.events || events.map((e) => e.id))
    .map((id) => events.find((e) => e.id === id))
    .filter((entity): entity is NonNullable<typeof entity> => entity != null)
    .filter((entity) => fuzzyMatch(entity.name, query));

  // Build tree from documents, entities, and transcripts
  const tree: TreeNode[] = [
    {
      id: "docs",
      name: "Documents",
      type: "folder",
      children: [
        ...sortedDocuments.map((doc) => ({
          id: doc.id,
          name: doc.title,
          type: "document" as const,
          documentId: doc.id,
        })),
        // Show pending creates as ghost items
        ...filteredPendingCreates.map((c) => ({
          id: `pending-${c._id}`,
          name: c.target,
          type: "document" as const,
          documentId: undefined,
        })),
      ],
    },
    ...(sortedTranscripts.length > 0
      ? [
          {
            id: "transcripts",
            name: "Transcripts",
            type: "folder" as const,
            children: sortedTranscripts.map((t) => ({
              id: t.id,
              name: t.title,
              type: "transcript" as const,
              transcriptId: t.id,
            })),
          },
        ]
      : []),
    {
      id: "entities",
      name: "Entities",
      type: "folder",
      children: [
        {
          id: "people",
          name: "People",
          type: "folder",
          children: sortedPeople.map((p) => ({
            id: p.id,
            name: p.name,
            type: "entity" as const,
            entityId: p.id,
          })),
        },
        {
          id: "orgs",
          name: "Organizations",
          type: "folder",
          children: sortedOrganizations.map((o) => ({
            id: o.id,
            name: o.name,
            type: "entity" as const,
            entityId: o.id,
          })),
        },
        {
          id: "projects",
          name: "Projects",
          type: "folder",
          children: sortedProjects.map((p) => ({
            id: p.id,
            name: p.name,
            type: "entity" as const,
            entityId: p.id,
          })),
        },
        ...(sortedEvents.length > 0
          ? [
              {
                id: "events",
                name: "Events",
                type: "folder" as const,
                children: sortedEvents.map((e) => ({
                  id: e.id,
                  name: e.name,
                  type: "entity" as const,
                  entityId: e.id,
                })),
              },
            ]
          : []),
      ],
    },
    {
      id: "models",
      name: "Models",
      type: "folder",
      children: [],
    },
  ];

  const handleContextMenu = (event: React.MouseEvent, node: TreeNode) => {
    event.preventDefault();
    if (!node.documentId && !node.entityId && !node.transcriptId) return;
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };

  const handleDragStart = (
    event: React.DragEvent,
    node: TreeNode,
    parentId?: string,
  ) => {
    setDraggedItem({ id: node.id, parentId: parentId || node.id });
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (draggedItem) {
      event.preventDefault();
    }
  };

  const handleDrop = (
    event: React.DragEvent,
    node: TreeNode,
    parentId?: string,
  ) => {
    event.preventDefault();
    if (!draggedItem) return;
    if ((parentId || node.id) !== draggedItem.parentId) return;

    setOrderBySection((prev) => {
      const section = prev[parentId || node.id] || [];
      const next = section.filter((id) => id !== draggedItem.id);
      const targetIndex = next.indexOf(node.id);
      if (targetIndex === -1) {
        next.push(draggedItem.id);
      } else {
        next.splice(targetIndex, 0, draggedItem.id);
      }
      return { ...prev, [parentId || node.id]: next };
    });
    setDraggedItem(null);
  };

  const handleRenameDocument = async (docId: string) => {
    const doc = documents[docId];
    if (!doc) return;
    const nextTitle = window.prompt("Rename document", doc.title);
    if (!nextTitle || nextTitle.trim() === doc.title) return;
    const slug = nextTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const directory = doc.path.substring(0, doc.path.lastIndexOf("/") + 1);
    const nextPath = `${directory}${slug || "untitled"}.md`;
    await updateDocumentMetadata(docId, {
      title: nextTitle.trim(),
      path: nextPath,
    });
  };

  const handleMoveDocument = async (docId: string) => {
    const doc = documents[docId];
    if (!doc) return;
    const nextPath = window.prompt("Move document to path", doc.path);
    if (!nextPath || nextPath.trim() === doc.path) return;
    await updateDocumentMetadata(docId, { path: nextPath.trim() });
  };

  const handleDeleteDocument = async (docId: string) => {
    const doc = documents[docId];
    if (!doc) return;
    const confirmDelete = window.confirm(
      `Delete "${doc.title}"? This cannot be undone.`,
    );
    if (!confirmDelete) return;
    await deleteDocument(docId);
  };

  const handleRenameEntity = async (entityId: string) => {
    const entity =
      people.find((p) => p.id === entityId) ||
      organizations.find((o) => o.id === entityId) ||
      projects.find((p) => p.id === entityId) ||
      events.find((e) => e.id === entityId);
    if (!entity) return;
    const nextName = window.prompt("Rename entity", entity.name);
    if (!nextName || nextName.trim() === entity.name) return;
    await updateEntity(entityId, { name: nextName.trim() });
  };

  const handleDeleteEntity = async (entityId: string) => {
    const entity =
      people.find((p) => p.id === entityId) ||
      organizations.find((o) => o.id === entityId) ||
      projects.find((p) => p.id === entityId) ||
      events.find((e) => e.id === entityId);
    if (!entity) return;
    const confirmDelete = window.confirm(
      `Delete "${entity.name}"? This cannot be undone.`,
    );
    if (!confirmDelete) return;
    await deleteEntity(entityId);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="
            flex-1 px-3 py-1.5 text-sm rounded-md
            bg-zinc-100 dark:bg-zinc-800
            border border-zinc-200 dark:border-zinc-700
            text-zinc-900 dark:text-zinc-100
            placeholder:text-zinc-500
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        />
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Collapse navigation"
          >
            ‹
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        {tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            onSelectDocument={handleSelectDocument}
            onSelectEntity={handleSelectEntity}
            onSelectTranscript={handleSelectTranscript}
            onAddDocument={handleNewDocument}
            selectedDocumentId={currentDocumentId}
            selectedEntityId={currentEntityId}
            selectedTranscriptId={currentTranscriptId}
            pendingChanges={pendingChanges || []}
            badgeCount={
              node.id === "docs"
                ? Object.values(pendingByDocument).reduce(
                    (sum, count) => sum + count,
                    0,
                  ) + filteredPendingCreates.length
                : undefined
            }
            onContextMenu={handleContextMenu}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
      {contextMenu && (
        <div
          className="fixed z-20"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="w-40 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1 text-sm">
            {contextMenu.node.documentId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleRenameDocument(contextMenu.node.documentId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMoveDocument(contextMenu.node.documentId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                >
                  Move
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteDocument(contextMenu.node.documentId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                >
                  Delete
                </button>
              </>
            )}
            {contextMenu.node.entityId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleRenameEntity(contextMenu.node.entityId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteEntity(contextMenu.node.entityId!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
