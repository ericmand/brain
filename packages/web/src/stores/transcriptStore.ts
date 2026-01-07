import { create } from "zustand";
import * as turso from "../lib/turso";
import type { TranscriptSegment } from "../lib/turso";

export type Transcript = {
  id: string;
  title: string;
  content: string;
  segments: TranscriptSegment[];
  meetingPlatform: string | null;
  participants: string[];
  durationSeconds: number | null;
  recordedAt: number;
  createdAt: number;
};

type TranscriptStore = {
  transcripts: Record<string, Transcript>;
  currentTranscriptId: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setCurrentTranscript: (transcriptId: string | null) => void;
  getCurrentTranscript: () => Transcript | null;
  getTranscript: (transcriptId: string) => Transcript | null;
  getAllTranscripts: () => Transcript[];
  createTranscript: (
    title: string,
    content: string,
    segments: TranscriptSegment[],
    meetingPlatform: string | null,
    participants: string[],
    durationSeconds: number | null,
    recordedAt: number,
  ) => Promise<string>;
  deleteTranscript: (transcriptId: string) => Promise<void>;
};

export const useTranscriptStore = create<TranscriptStore>((set, get) => ({
  transcripts: {},
  currentTranscriptId: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      set({ isLoading: true });

      // Load all transcripts
      const transcripts = await turso.getAllTranscripts();
      const transcriptsMap: Record<string, Transcript> = {};

      for (const t of transcripts) {
        transcriptsMap[t.id] = {
          id: t.id,
          title: t.title,
          content: t.content,
          segments: t.segments,
          meetingPlatform: t.meeting_platform,
          participants: t.participants,
          durationSeconds: t.duration_seconds,
          recordedAt: t.recorded_at,
          createdAt: t.created_at,
        };
      }

      set({
        transcripts: transcriptsMap,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to initialize transcript store:", error);
      set({ isLoading: false });
    }
  },

  setCurrentTranscript: (transcriptId) => {
    set({ currentTranscriptId: transcriptId });
  },

  getCurrentTranscript: () => {
    const state = get();
    if (!state.currentTranscriptId) return null;
    return state.transcripts[state.currentTranscriptId] || null;
  },

  getTranscript: (transcriptId) => {
    return get().transcripts[transcriptId] || null;
  },

  getAllTranscripts: () => {
    return Object.values(get().transcripts);
  },

  createTranscript: async (
    title,
    content,
    segments,
    meetingPlatform,
    participants,
    durationSeconds,
    recordedAt,
  ) => {
    const id = `transcript-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newTranscript: Transcript = {
      id,
      title,
      content,
      segments,
      meetingPlatform,
      participants,
      durationSeconds,
      recordedAt,
      createdAt: Date.now(),
    };

    // Update local state
    set((state) => ({
      transcripts: { ...state.transcripts, [id]: newTranscript },
      currentTranscriptId: id,
    }));

    // Persist to Turso
    try {
      await turso.createTranscript(
        id,
        title,
        content,
        segments,
        meetingPlatform,
        participants,
        durationSeconds,
        recordedAt,
      );
    } catch (error) {
      console.error("Failed to persist new transcript:", error);
    }

    return id;
  },

  deleteTranscript: async (transcriptId) => {
    set((state) => {
      const rest = { ...state.transcripts };
      delete rest[transcriptId];
      return {
        transcripts: rest,
        currentTranscriptId:
          state.currentTranscriptId === transcriptId
            ? null
            : state.currentTranscriptId,
      };
    });

    try {
      await turso.deleteTranscript(transcriptId);
    } catch (error) {
      console.error("Failed to delete transcript:", error);
    }
  },
}));
