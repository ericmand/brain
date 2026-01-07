const { ConvexHttpClient } = require("convex/browser");
const { auth } = require("./auth");
require("dotenv").config();

let client = null;

function getConvexClient() {
  if (client) return client;

  const url = process.env.CONVEX_URL;
  if (!url) {
    console.warn("CONVEX_URL not set, Convex sync disabled");
    return null;
  }

  client = new ConvexHttpClient(url);
  return client;
}

/**
 * Set auth token on Convex client
 */
function setAuthToken(token) {
  const convex = getConvexClient();
  if (convex && token) {
    convex.setAuth(async () => token);
    console.log("[Convex] Auth token set");
  }
}

// Update auth token when user authenticates
auth.on("authenticated", ({ token }) => {
  setAuthToken(token);
});

auth.on("logout", () => {
  const convex = getConvexClient();
  if (convex) {
    convex.clearAuth();
    console.log("[Convex] Auth cleared");
  }
});

// Sync a transcript to Convex for real-time updates
async function syncTranscriptToConvex({
  tursoId,
  title,
  meetingPlatform,
  participants,
  durationSeconds,
  recordedAt,
}) {
  const convex = getConvexClient();
  if (!convex) return null;

  // Ensure we have auth
  if (!auth.isAuthenticated()) {
    console.warn("[Convex] Not authenticated, skipping sync");
    return null;
  }

  try {
    const result = await convex.mutation("transcripts:sync", {
      tursoId,
      title,
      meetingPlatform: meetingPlatform || undefined,
      participants: participants || [],
      durationSeconds: durationSeconds || undefined,
      recordedAt,
    });

    console.log(`Synced transcript to Convex: ${tursoId}`);
    return result;
  } catch (error) {
    console.error("Failed to sync to Convex:", error);
    return null;
  }
}

// Create an entity proposal in Convex
async function createEntityProposal({
  transcriptId, // Convex transcript ID
  entityType,
  entityName,
  context,
}) {
  const convex = getConvexClient();
  if (!convex) return null;

  // Ensure we have auth
  if (!auth.isAuthenticated()) {
    console.warn("[Convex] Not authenticated, skipping entity proposal");
    return null;
  }

  try {
    const result = await convex.mutation("transcripts:createProposal", {
      transcriptId,
      entityType,
      entityName,
      context,
    });

    console.log(`Created entity proposal: ${entityType} "${entityName}"`);
    return result;
  } catch (error) {
    console.error("Failed to create entity proposal:", error);
    return null;
  }
}

module.exports = {
  getConvexClient,
  setAuthToken,
  syncTranscriptToConvex,
  createEntityProposal,
};
