const { z } = require("zod");

const assistantHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const assistantChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(assistantHistoryItemSchema).max(40).optional(),
});

const assistantTtsRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  speaker: z.string().trim().min(1).max(120).optional(),
  language: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .regex(
      /^[a-z]{2,3}(?:-[a-z]{2})?$/i,
      "Language must be a short code like en or ro",
    )
    .optional(),
});

function formatZodError(error) {
  const issue = error?.issues?.[0];
  if (!issue) {
    return "Invalid request payload.";
  }

  const path =
    Array.isArray(issue.path) && issue.path.length > 0
      ? `${issue.path.join(".")}: `
      : "";
  return `${path}${issue.message}`;
}

module.exports = {
  assistantChatRequestSchema,
  assistantTtsRequestSchema,
  formatZodError,
};
