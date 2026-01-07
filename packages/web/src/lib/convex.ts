import { ConvexReactClient } from "convex/react";

// For development, we'll use a placeholder URL
// In production, this should come from environment variables
const convexUrl =
  import.meta.env.VITE_CONVEX_URL || "https://placeholder.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
