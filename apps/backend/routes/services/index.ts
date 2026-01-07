// Services index - exports all route services

export {
  getOrCreateChat,
  saveMessage,
  isFirstMessage,
  getChatHistory,
  getRecentMessages,
  getProjectChatMessages,
} from "./chatService";

export { generateCodeSummary } from "./summaryService";

export {
  getCurrentProjectContext,
  buildEnhancedPrompt,
} from "./contextService";
