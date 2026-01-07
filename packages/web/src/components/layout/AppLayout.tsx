import { useState, useEffect, useRef } from "react";
import { LeftPane } from "./LeftPane";
import { CenterPane } from "./CenterPane";
import { RightPane } from "./RightPane";
import { useDocumentStore } from "../../stores/documentStore";
import { useAuth, useUser } from "@clerk/clerk-react";

export function AppLayout() {
  const [leftPaneWidth, setLeftPaneWidth] = useState(260);
  const [rightPaneWidth, setRightPaneWidth] = useState(380);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"nav" | "doc">("doc");
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const { initialize, isLoading, isInitialized } = useDocumentStore();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const handleChange = () => {
      setIsMobile(media.matches);
    };
    handleChange();
    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsAiSheetOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === "1") {
        event.preventDefault();
        if (isMobile) {
          setActiveTab("nav");
        } else {
          setIsLeftCollapsed(false);
          leftPaneRef.current?.focus();
        }
      }
      if (event.key === "2") {
        event.preventDefault();
        if (isMobile) {
          setActiveTab("doc");
        } else {
          centerPaneRef.current?.focus();
        }
      }
      if (event.key === "3") {
        event.preventDefault();
        if (isMobile) {
          setIsAiSheetOpen(true);
        } else {
          setIsRightCollapsed(false);
          rightPaneRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile]);

  if (isLoading && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-zinc-500">Loading documents...</div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("nav")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
              activeTab === "nav"
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            Nav
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("doc")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
              activeTab === "doc"
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            Doc
          </button>
          <button
            type="button"
            onClick={() => setIsAiSheetOpen(true)}
            className="ml-auto px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            AI
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "nav" ? <LeftPane /> : <CenterPane />}
        </div>
        {isAiSheetOpen && (
          <div className="fixed inset-x-0 bottom-0 h-[70vh] bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-t-2xl overflow-hidden">
            <RightPane
              theme={theme}
              onToggleTheme={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
              onSignOut={() => signOut()}
              userAvatarUrl={user?.imageUrl}
              userInitials={
                `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() ||
                "U"
              }
              showCloseButton
              onClose={() => setIsAiSheetOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-screen bg-white dark:bg-zinc-900">
      {/* Left Pane - Navigation */}
      <div
        ref={leftPaneRef}
        tabIndex={-1}
        className={`flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 transition-[width] duration-200 ${
          isLeftCollapsed ? "w-0 border-r-0" : ""
        }`}
        style={{ width: isLeftCollapsed ? 0 : leftPaneWidth }}
      >
        {!isLeftCollapsed && (
          <LeftPane onCollapse={() => setIsLeftCollapsed(true)} />
        )}
      </div>

      {/* Resize handle - left */}
      {!isLeftCollapsed && (
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = leftPaneWidth;

            const onMouseMove = (e: MouseEvent) => {
              const newWidth = startWidth + (e.clientX - startX);
              setLeftPaneWidth(Math.max(200, Math.min(400, newWidth)));
            };

            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
        />
      )}

      {/* Center Pane - Document */}
      <div
        ref={centerPaneRef}
        tabIndex={-1}
        className="flex-1 min-w-0 overflow-hidden"
      >
        <CenterPane />
      </div>

      {/* Resize handle - right */}
      {!isRightCollapsed && (
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = rightPaneWidth;

            const onMouseMove = (e: MouseEvent) => {
              const newWidth = startWidth - (e.clientX - startX);
              setRightPaneWidth(Math.max(300, Math.min(600, newWidth)));
            };

            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
        />
      )}

      {/* Right Pane - AI Chat */}
      <div
        ref={rightPaneRef}
        tabIndex={-1}
        className={`flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 transition-[width] duration-200 ${
          isRightCollapsed ? "w-0 border-l-0" : ""
        }`}
        style={{ width: isRightCollapsed ? 0 : rightPaneWidth }}
      >
        {!isRightCollapsed && (
          <RightPane
            theme={theme}
            onToggleTheme={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            onSignOut={() => signOut()}
            userAvatarUrl={user?.imageUrl}
            userInitials={
              `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() ||
              "U"
            }
            showCloseButton
            onClose={() => setIsRightCollapsed(true)}
          />
        )}
      </div>
      {isLeftCollapsed && (
        <button
          type="button"
          onClick={() => setIsLeftCollapsed(false)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 shadow-sm"
          aria-label="Expand navigation"
        >
          ›
        </button>
      )}
      {isRightCollapsed && (
        <button
          type="button"
          onClick={() => setIsRightCollapsed(false)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 shadow-sm"
          aria-label="Expand assistant"
        >
          ‹
        </button>
      )}
    </div>
  );
}
