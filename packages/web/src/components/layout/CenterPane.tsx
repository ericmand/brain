import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDocumentStore } from "../../stores/documentStore";
import { useEntityStore } from "../../stores/entityStore";
import { useTranscriptStore } from "../../stores/transcriptStore";
import { DocumentEditor } from "../editor/DocumentEditor";
import { useCallback, useEffect, useState } from "react";
import { VERB_METADATA } from "../../lib/entities";

type ConvexChange = {
  _id: Id<"changes">;
  documentId: string;
  operation: "insert" | "replace" | "delete" | "create";
  target: string;
  content?: string;
  description: string;
  status: "pending" | "applied" | "dismissed";
};

function PendingChangesBanner({
  changes,
  onApply,
  onDismiss,
}: {
  changes: ConvexChange[];
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="border-b border-amber-200 dark:border-amber-800">
      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950">
        <div className="flex items-center justify-between">
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>
              {changes.length} pending change{changes.length > 1 ? "s" : ""}
            </strong>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onApply}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1 text-xs bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Inline diff preview */}
      <div className="max-h-64 overflow-auto">
        {changes.map((change) => {
          const isDelete = change.operation === "delete";
          return (
            <div
              key={change._id}
              className={`border-t ${isDelete ? "border-red-100 dark:border-red-900" : "border-amber-100 dark:border-amber-900"}`}
            >
              <div
                className={`px-4 py-1 text-xs ${isDelete ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" : "bg-amber-50/50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"}`}
              >
                {change.operation}: {change.description}
              </div>
              {change.content && !isDelete && (
                <div
                  className="px-4 py-2 bg-green-50 dark:bg-green-950/50 border-l-4 border-green-500 prose prose-sm prose-zinc dark:prose-invert max-w-none prose-headings:mb-1 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0"
                  dangerouslySetInnerHTML={{ __html: change.content }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Entity type display helpers
const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "Person",
  organization: "Organization",
  project: "Project",
  event: "Event",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  organization:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  project: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  event: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function EntityDetail() {
  const { getCurrentEntity, getRelationshipsForEntity, getEntity } =
    useEntityStore();

  const entity = getCurrentEntity();

  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-500">Select an entity to view</p>
      </div>
    );
  }

  const relationships = getRelationshipsForEntity(entity.id);

  // Group relationships by direction
  const outgoing = relationships.filter((r) => r.subject_id === entity.id);
  const incoming = relationships.filter((r) => r.object_id === entity.id);

  const renderRelationship = (
    rel: (typeof relationships)[0],
    isOutgoing: boolean,
  ) => {
    const otherEntityId = isOutgoing ? rel.object_id : rel.subject_id;
    const otherEntity = getEntity(otherEntityId);
    const verbMeta = VERB_METADATA[rel.type];
    const label = isOutgoing
      ? verbMeta?.label || rel.type
      : verbMeta?.inverse || verbMeta?.label || rel.type;

    return (
      <div
        key={rel.id}
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="text-zinc-500 text-sm">{label}</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {otherEntity?.name || otherEntityId}
        </span>
        {otherEntity && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${ENTITY_TYPE_COLORS[otherEntity.type]}`}
          >
            {ENTITY_TYPE_LABELS[otherEntity.type]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {entity.name}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded ${ENTITY_TYPE_COLORS[entity.type]}`}
          >
            {ENTITY_TYPE_LABELS[entity.type]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Properties */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Properties
            </h2>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              {Object.keys(entity.properties).length === 0 ? (
                <p className="text-zinc-500 text-sm">No properties set</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(entity.properties).map(([key, propValue]) => {
                    // Handle both simple values and PropertyValue objects
                    const value =
                      typeof propValue === "object" &&
                      propValue !== null &&
                      "value" in propValue
                        ? (propValue as { value: unknown }).value
                        : propValue;
                    const confidence =
                      typeof propValue === "object" &&
                      propValue !== null &&
                      "confidence" in propValue
                        ? (propValue as { confidence?: number }).confidence
                        : undefined;

                    return (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-zinc-500 text-sm min-w-[100px]">
                          {key}:
                        </span>
                        <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                          {String(value)}
                        </span>
                        {confidence !== undefined && confidence < 1 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            ({Math.round(confidence * 100)}% confident)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Relationships */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Relationships
            </h2>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              {relationships.length === 0 ? (
                <p className="text-zinc-500 text-sm">No relationships</p>
              ) : (
                <div className="space-y-1">
                  {outgoing.map((r) => renderRelationship(r, true))}
                  {incoming.map((r) => renderRelationship(r, false))}
                </div>
              )}
            </div>
          </section>

          {/* Metadata */}
          <section>
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Metadata
            </h2>
            <div className="text-xs text-zinc-500 space-y-1">
              <div>Created: {new Date(entity.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(entity.updated_at).toLocaleString()}</div>
              <div className="font-mono text-zinc-400">{entity.id}</div>
            </div>
          </section>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <span>{ENTITY_TYPE_LABELS[entity.type]}</span>
          <span className="text-zinc-400">
            {relationships.length} relationship
            {relationships.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Last updated {new Date(entity.updated_at).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Platform display names
const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom",
  "google-meet": "Google Meet",
  teams: "Microsoft Teams",
  slack: "Slack",
};

function TranscriptDetail() {
  const { getCurrentTranscript } = useTranscriptStore();

  const transcript = getCurrentTranscript();

  if (!transcript) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-500">Select a transcript to view</p>
      </div>
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown duration";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {transcript.title}
          </h1>
          {transcript.meetingPlatform && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {PLATFORM_LABELS[transcript.meetingPlatform] ||
                transcript.meetingPlatform}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Meeting info */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Meeting Info
            </h2>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 text-sm min-w-[100px]">
                  Date:
                </span>
                <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                  {formatDate(transcript.recordedAt)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 text-sm min-w-[100px]">
                  Duration:
                </span>
                <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                  {formatDuration(transcript.durationSeconds)}
                </span>
              </div>
              {transcript.participants.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 text-sm min-w-[100px]">
                    Participants:
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                    {transcript.participants.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Transcript content */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Transcript
            </h2>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              {transcript.segments.length === 0 ? (
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
                  {transcript.content || (
                    <p className="text-zinc-500">No transcript content</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.segments.map((segment, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="min-w-[80px] text-xs text-zinc-400">
                        {Math.floor(segment.start / 60)}:
                        {String(Math.floor(segment.start % 60)).padStart(
                          2,
                          "0",
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                          {segment.speaker}:
                        </span>
                        <span className="text-zinc-900 dark:text-zinc-100 text-sm ml-2">
                          {segment.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <span>Transcript</span>
          <span className="text-zinc-400">
            {transcript.segments.length} segments
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Recorded {formatDate(transcript.recordedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function CenterPane() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);

  const {
    getCurrentDocument,
    updateDocument,
    getDocument,
    setCurrentDocument,
    setPendingChanges,
    applyAllChanges,
    dismissAllChanges,
    lastCreatedDocumentId,
    clearLastCreatedDocumentId,
  } = useDocumentStore();

  const { currentEntityId } = useEntityStore();
  const { currentTranscriptId } = useTranscriptStore();

  const document = getCurrentDocument();

  // Get or create session (same as RightPane)
  const getOrCreateSession = useMutation(api.sessions.getOrCreate);
  const resolveChange = useMutation(api.messages.resolveChange);

  useEffect(() => {
    if (!sessionId) {
      getOrCreateSession({ contextType: "global" }).then(setSessionId);
    }
  }, [sessionId, getOrCreateSession]);

  // Query pending changes from Convex
  const convexPendingChanges = useQuery(
    api.messages.getPendingChanges,
    sessionId ? { sessionId } : "skip",
  ) as ConvexChange[] | undefined;

  // Auto-focus callback for newly created documents
  const handleAutoFocusComplete = useCallback(() => {
    clearLastCreatedDocumentId();
  }, [clearLastCreatedDocumentId]);

  // If an entity is selected, show the entity detail view
  if (currentEntityId) {
    return <EntityDetail />;
  }

  // If a transcript is selected, show the transcript detail view
  if (currentTranscriptId) {
    return <TranscriptDetail />;
  }

  // Filter changes for the current document
  const pendingForThisDoc = (convexPendingChanges || []).filter(
    (c) => c.documentId === document?.id,
  );

  // Check if there are pending changes for OTHER documents
  const pendingForOtherDocs = (convexPendingChanges || []).filter(
    (c) => c.documentId !== document?.id && c.documentId !== "new",
  );

  // Check for pending "create" operations
  const pendingCreates = (convexPendingChanges || []).filter(
    (c) => c.operation === "create" || c.documentId === "new",
  );

  const handleApply = async () => {
    if (!pendingForThisDoc.length) return;

    // Set pending changes in local store and apply
    setPendingChanges(
      pendingForThisDoc.map((c) => ({
        documentId: c.documentId,
        operation: c.operation,
        target: c.target,
        content: c.content || "",
        description: c.description,
      })),
    );
    applyAllChanges();

    // Mark as applied in Convex
    for (const change of pendingForThisDoc) {
      await resolveChange({ changeId: change._id, status: "applied" });
    }
  };

  const handleDismiss = async () => {
    dismissAllChanges();

    // Mark as dismissed in Convex
    for (const change of pendingForThisDoc) {
      await resolveChange({ changeId: change._id, status: "dismissed" });
    }
  };

  const getDocTitle = (docId: string) => {
    const doc = getDocument(docId);
    return doc?.title || docId;
  };

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-500">Select a document to edit</p>
      </div>
    );
  }

  const totalPending = convexPendingChanges?.length || 0;
  const shouldFocusTitle = document?.id === lastCreatedDocumentId;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {document.title}
        </h1>
        <div className="flex items-center gap-2">
          {totalPending > 0 && (
            <span className="text-xs text-amber-500 font-medium">
              {totalPending} pending
            </span>
          )}
          <span className="text-xs text-zinc-500">Saved</span>
        </div>
      </div>

      {/* Show pending changes for this document */}
      {pendingForThisDoc.length > 0 && (
        <PendingChangesBanner
          changes={pendingForThisDoc}
          onApply={handleApply}
          onDismiss={handleDismiss}
        />
      )}

      {/* Show indicator for changes in other documents */}
      {(pendingForOtherDocs.length > 0 || pendingCreates.length > 0) &&
        pendingForThisDoc.length === 0 && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-800 dark:text-blue-200 flex items-center flex-wrap gap-x-2">
              <span>Changes pending in:</span>
              {pendingForOtherDocs.map((change) => (
                <button
                  key={change._id}
                  onClick={() => setCurrentDocument(change.documentId)}
                  className="underline hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {getDocTitle(change.documentId)}
                </button>
              ))}
              {pendingCreates.map((change) => (
                <span key={change._id} className="italic">
                  + new: {change.target}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          <DocumentEditor
            content={document.content}
            onChange={(content) => updateDocument(document.id, content)}
            autoFocusTitle={shouldFocusTitle}
            onAutoFocusComplete={handleAutoFocusComplete}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <span>Document</span>
          <span className="text-zinc-400">
            {document.path.replace(/\.md$/, "")}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Last edited {new Date(document.updatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
