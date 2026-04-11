import Anthropic from "@anthropic-ai/sdk";

// Singleton — SDK auto-reads ANTHROPIC_API_KEY from env
export const anthropic = new Anthropic();
