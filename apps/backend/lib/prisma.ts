// Re-export everything from shared db package
// The prisma client and all types are handled by @appwit/db
export { prisma } from "@appwit/db";

// For types, import from @appwit/db which re-exports from its generated client
// Note: These need to be imported where used since @appwit/db may not export them
// If you need enums, import them directly: import { MessageRole } from "@prisma/client"
