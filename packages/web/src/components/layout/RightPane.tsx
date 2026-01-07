import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import ReactMarkdown from "react-markdown";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDocumentStore } from "../../stores/documentStore";
import { useEntityStore } from "../../stores/entityStore";
import {
  chatWithAI,
  getPendingEntityMutations,
  type ChatMessage,
} from "../../lib/ai";
import type { EntityType, RelationshipType } from "../../lib/entities";

type ChangeWithStatus = {
  _id: Id<"changes">;
  documentId: string;
  operation: "insert" | "replace" | "delete" | "create";
  target: string;
  content: string;
  description: string;
  status: "pending" | "applied" | "dismissed";
};

type MessageWithChanges = {
  _id: Id<"messages">;
  sessionId: Id<"sessions">;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  changes?: ChangeWithStatus[];
};

function ChangePreview({
  change,
  documentTitle,
}: {
  change: ChangeWithStatus;
  documentTitle: string;
}) {
  const isCreate = change.operation === "create" || change.documentId === "new";

  return (
    <div className="text-xs border border-zinc-300 dark:border-zinc-600 rounded overflow-hidden">
      <div className="bg-zinc-200 dark:bg-zinc-700 px-2 py-1 flex items-center justify-between">
        <span className="font-medium">
          {isCreate ? `Create: ${change.target}` : documentTitle}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {change.operation}
        </span>
      </div>
      <div
        className="p-2 bg-green-50 dark:bg-green-950 border-l-2 border-green-500 prose prose-sm prose-zinc dark:prose-invert max-w-none prose-headings:mb-1 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: change.content }}
      />
    </div>
  );
}

function MessageBubble({
  message,
  onApply,
  onDismiss,
  getDocumentTitle,
}: {
  message: MessageWithChanges;
  onApply?: () => void;
  onDismiss?: () => void;
  getDocumentTitle: (id: string) => string;
}) {
  const isUser = message.role === "user";
  const hasChanges = message.changes && message.changes.length > 0;
  const allApplied = message.changes?.every((c) => c.status === "applied");
  const allDismissed = message.changes?.every((c) => c.status === "dismissed");
  const hasPending = message.changes?.some((c) => c.status === "pending");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-lg px-3 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full">
      <div className="w-full text-sm text-zinc-900 dark:text-zinc-100">
        <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-inherit">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {hasChanges && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {message.changes!.length} change
              {message.changes!.length > 1 ? "s" : ""} proposed:
            </div>

            {message.changes!.map((change) => (
              <ChangePreview
                key={change._id}
                change={change}
                documentTitle={getDocumentTitle(change.documentId)}
              />
            ))}

            {hasPending && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onApply}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  Apply All
                </button>
                <button
                  onClick={onDismiss}
                  className="px-3 py-1 text-xs bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
            {allApplied && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Applied
              </div>
            )}
            {allDismissed && (
              <div className="text-xs text-zinc-500">Dismissed</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RightPane({
  theme,
  onToggleTheme,
  onSignOut,
  userAvatarUrl,
  userInitials = "U",
  showCloseButton = false,
  onClose,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut?: () => void;
  userAvatarUrl?: string | null;
  userInitials?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  // Convex queries and mutations
  const messages = useQuery(
    api.messages.getBySession,
    sessionId ? { sessionId } : "skip",
  ) as MessageWithChanges[] | undefined;

  const getOrCreateSession = useMutation(api.sessions.getOrCreate);
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const sendAssistantMessage = useMutation(api.messages.sendAssistantMessage);
  const resolveAllChanges = useMutation(
    api.messages.resolveAllChangesForMessage,
  );

  // Document store for applying changes
  const {
    getCurrentDocument,
    getAllDocuments,
    getDocument,
    setPendingChanges,
    applyAllChanges,
    dismissAllChanges,
  } = useDocumentStore();

  // Entity store for context and mutations
  const {
    entities,
    relationships,
    currentEntityId,
    createEntity,
    createRelationship,
  } = useEntityStore();

  const currentDocument = getCurrentDocument();
  const allDocuments = getAllDocuments();
  const allEntities = Object.values(entities);
  const allRelationships = relationships;

  // Initialize session
  useEffect(() => {
    if (!sessionId) {
      getOrCreateSession({ contextType: "global" }).then(setSessionId);
    }
  }, [sessionId, getOrCreateSession]);

  const isInitialLoad = useRef(true);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "instant" : "smooth",
    });
  };

  useEffect(() => {
    // On initial load, scroll instantly (no animation)
    // On subsequent updates, scroll smoothly
    scrollToBottom(isInitialLoad.current);
    isInitialLoad.current = false;
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        avatarButtonRef.current &&
        !avatarButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const getDocumentTitle = (docId: string): string => {
    if (docId === "new") return "New Document";
    const doc = getDocument(docId);
    return doc?.title || docId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Send user message to Convex
      await sendUserMessage({
        sessionId,
        content: userInput,
      });

      // Build conversation history from existing messages
      const conversationHistory: ChatMessage[] = (messages || []).map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        }),
      );

      // Build workspace context with documents and entities
      const workspace = {
        documents: allDocuments.map((doc) => ({
          id: doc.id,
          path: doc.path,
          title: doc.title,
          content: doc.content,
          frontmatter: doc.frontmatter,
          frontmatterRaw: doc.frontmatterRaw,
        })),
        entities: allEntities.map((e) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          properties: e.properties as Record<string, unknown>,
        })),
        relationships: allRelationships.map((r) => ({
          id: r.id,
          type: r.type,
          subject_id: r.subject_id,
          object_id: r.object_id,
          properties: r.properties as Record<string, unknown>,
        })),
        activeDocumentId: currentDocument?.id || null,
      };

      // Call AI with full workspace context
      const response = await chatWithAI(
        workspace,
        userInput,
        conversationHistory,
      );

      // Apply any pending entity mutations
      const entityMutations = getPendingEntityMutations();
      for (const mutation of entityMutations) {
        if (mutation.type === "create_entity") {
          await createEntity(
            mutation.entityType as EntityType,
            mutation.name,
            mutation.properties,
          );
        } else if (mutation.type === "create_relationship") {
          await createRelationship(
            mutation.relType as RelationshipType,
            mutation.subjectId,
            mutation.objectId,
            mutation.properties,
          );
        }
      }

      // Send assistant response to Convex
      await sendAssistantMessage({
        sessionId,
        content: response.message,
        changes: response.changes,
      });

      // If there are changes, set them as pending in the local document store
      if (response.changes && response.changes.length > 0) {
        setPendingChanges(
          response.changes.map((c) => ({
            ...c,
            content: c.content || "",
          })),
        );
      }
    } catch (error) {
      console.error("AI error:", error);
      await sendAssistantMessage({
        sessionId,
        content: "Sorry, I encountered an error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async (message: MessageWithChanges) => {
    if (!message.changes || !sessionId) return;

    // Set pending changes from the message data (in case page was refreshed)
    const pendingChanges = message.changes
      .filter((c) => c.status === "pending")
      .map((c) => ({
        documentId: c.documentId,
        operation: c.operation,
        target: c.target,
        content: c.content,
        description: c.description,
      }));

    if (pendingChanges.length > 0) {
      setPendingChanges(pendingChanges);
      // Apply all changes locally
      applyAllChanges();
    }

    // Mark as applied in Convex
    await resolveAllChanges({
      messageId: message._id,
      status: "applied",
    });
  };

  const handleDismiss = async (message: MessageWithChanges) => {
    if (!sessionId) return;

    // Dismiss locally
    dismissAllChanges();

    // Mark as dismissed in Convex
    await resolveAllChanges({
      messageId: message._id,
      status: "dismissed",
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onClose?.()}
              className="h-7 w-7 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close panel"
            >
              ×
            </button>
          )}
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            AI Assistant
          </h2>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`}
            />
            <span className="text-xs text-zinc-500">
              {isLoading ? "Thinking..." : "Ready"}
            </span>
          </div>
          <button
            ref={avatarButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt="User avatar"
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              userInitials
            )}
          </button>
          {isMenuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute right-0 top-full mt-2 w-40 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1 text-sm z-10"
            >
              <button
                type="button"
                onClick={() => {
                  onToggleTheme();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                role="menuitem"
              >
                Theme: {theme === "dark" ? "Dark" : "Light"}
              </button>
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                  role="menuitem"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context indicator */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
        <div className="text-xs text-zinc-500">
          Viewing:{" "}
          <span className="text-zinc-700 dark:text-zinc-300">
            {currentDocument?.title ||
              (currentEntityId ? entities[currentEntityId]?.name : null) ||
              "Nothing selected"}
          </span>
          <span className="text-zinc-400 ml-2">
            ({allDocuments.length} docs, {allEntities.length} entities)
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {(!messages || messages.length === 0) && (
          <div className="text-center text-zinc-500 text-sm py-8">
            <p>Ask me anything or request changes to your documents.</p>
            <p className="text-xs mt-2">
              I can see all {allDocuments.length} documents in your workspace.
            </p>
          </div>
        )}
        {messages?.map((message) => (
          <MessageBubble
            key={message._id}
            message={message}
            onApply={() => handleApply(message)}
            onDismiss={() => handleDismiss(message)}
            getDocumentTitle={getDocumentTitle}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800"
      >
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask anything or request changes..."
            disabled={isLoading}
            rows={1}
            className="
              flex-1 px-3 py-2 text-sm rounded-lg resize-none
              bg-white dark:bg-zinc-800
              border border-zinc-200 dark:border-zinc-700
              text-zinc-900 dark:text-zinc-100
              placeholder:text-zinc-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50
              min-h-[38px] max-h-[200px]
            "
            style={{ height: "auto", overflow: "hidden" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 200) + "px";
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="
              px-4 py-2 text-sm font-medium rounded-lg
              bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100
              hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors
              focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900
              disabled:opacity-50 disabled:cursor-not-allowed
              h-[38px]
            "
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
