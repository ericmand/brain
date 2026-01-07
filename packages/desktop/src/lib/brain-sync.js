/**
 * Brain Sync - Syncs transcripts to the Brain knowledge system via Convex
 *
 * This module handles:
 * 1. Syncing to Convex (real-time updates for web app)
 * 2. Running entity extraction and creating proposals
 *
 * Note: Turso storage is handled by the web app when it receives Convex updates
 */

const {
  syncTranscriptToConvex,
  createEntityProposal,
} = require("./convex-sync");
const { extractEntities } = require("./extraction");

/**
 * Sync a completed meeting to the Brain system
 *
 * @param {Object} meeting - The meeting object from Muesli
 * @param {string} meeting.id - Unique meeting ID
 * @param {string} meeting.title - Meeting title
 * @param {Array} meeting.transcript - Array of transcript segments
 * @param {string} meeting.content - Formatted content/summary
 * @param {string} meeting.platform - Meeting platform (zoom, meet, etc)
 * @param {Array} meeting.participants - Array of participant objects
 * @param {string} meeting.recordingEndTime - ISO timestamp of when recording ended
 */
async function syncMeetingToBrain(meeting) {
  console.log(`[Brain Sync] Starting sync for meeting: ${meeting.id}`);

  try {
    // Convert transcript to segments format
    const segments = (meeting.transcript || []).map((entry, index) => ({
      start: index * 30, // Approximate timing (30 seconds per segment as placeholder)
      end: (index + 1) * 30,
      speaker: entry.speaker || "Unknown",
      text: entry.text || "",
    }));

    // Calculate duration from transcript segments
    const durationSeconds =
      segments.length > 0 ? segments[segments.length - 1].end : null;

    // Extract participant names
    const participants = (meeting.participants || []).map(
      (p) => p.name || "Unknown",
    );

    // Create transcript ID
    const tursoId = `transcript-${meeting.id}`;

    // 1. Sync to Convex (which will trigger web app to save to Turso)
    console.log(`[Brain Sync] Syncing to Convex...`);
    let convexTranscriptId = null;
    try {
      convexTranscriptId = await syncTranscriptToConvex({
        tursoId,
        title: meeting.title || "Untitled Meeting",
        meetingPlatform: meeting.platform || null,
        participants,
        durationSeconds,
        recordedAt: meeting.recordingEndTime
          ? new Date(meeting.recordingEndTime).getTime()
          : Date.now(),
      });
      console.log(`[Brain Sync] Synced to Convex: ${convexTranscriptId}`);
    } catch (error) {
      console.error(`[Brain Sync] Convex sync failed:`, error.message);
      return { success: false, error: error.message };
    }

    // 2. Extract entities and create proposals
    if (convexTranscriptId && segments.length > 0) {
      console.log(`[Brain Sync] Extracting entities...`);
      try {
        const { entities } = await extractEntities(
          meeting.title || "Untitled Meeting",
          segments,
        );

        console.log(`[Brain Sync] Found ${entities.length} entities`);

        // Create proposals for each extracted entity
        for (const entity of entities) {
          try {
            await createEntityProposal({
              transcriptId: convexTranscriptId,
              entityType: entity.type,
              entityName: entity.name,
              context: entity.context,
            });
          } catch (error) {
            console.error(
              `[Brain Sync] Failed to create proposal for ${entity.name}:`,
              error.message,
            );
          }
        }

        console.log(`[Brain Sync] Created ${entities.length} entity proposals`);
      } catch (error) {
        console.error(`[Brain Sync] Entity extraction failed:`, error.message);
      }
    }

    console.log(`[Brain Sync] Completed sync for meeting: ${meeting.id}`);
    return { success: true, convexTranscriptId };
  } catch (error) {
    console.error(`[Brain Sync] Sync failed:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  syncMeetingToBrain,
};
