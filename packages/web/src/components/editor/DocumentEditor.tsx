import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type DocumentEditorProps = {
  content: string;
  onChange?: (content: string) => void;
  editable?: boolean;
  autoFocusTitle?: boolean;
  onAutoFocusComplete?: () => void;
};

export function DocumentEditor({
  content,
  onChange,
  editable = true,
  autoFocusTitle = false,
  onAutoFocusComplete,
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[500px] prose-headings:mb-2 prose-headings:mt-4 prose-p:my-1 prose-ul:my-1 prose-li:my-0",
      },
    },
  });

  // Update editor content when content prop changes (e.g., when applying a diff)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !autoFocusTitle) return;

    const frame = requestAnimationFrame(() => {
      let focusPosition: number | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          focusPosition = pos + node.nodeSize - 1;
          return false;
        }
        return true;
      });

      if (focusPosition !== null) {
        editor.commands.setTextSelection(focusPosition);
        editor.commands.focus();
      } else {
        editor.commands.focus("start");
      }

      onAutoFocusComplete?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFocusTitle, editor, onAutoFocusComplete]);

  return (
    <div className="document-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
