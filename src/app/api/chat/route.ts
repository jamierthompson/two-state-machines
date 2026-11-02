import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import type { ChatMessage } from "@/lib/chat-message";
import { model } from "@/lib/model";
import { tools } from "@/lib/tools";

export const maxDuration = 60;

const system = `You are the assistant inside a small demo that shows how a chat
interface tracks state. Keep every reply to one or two short sentences.

Think briefly before you answer. When asked about the weather, call getWeather.
When asked to delete or remove a file, call deleteFile; it needs the person's
approval, and if they deny it, say so and do not try again.`;

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();

  const result = streamText({
    model: model(),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    toolApproval: { deleteFile: "user-approval" },
    stopWhen: stepCountIs(5),
    reasoning: "low",
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
