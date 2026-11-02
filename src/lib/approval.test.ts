import { Chat } from "@ai-sdk/react";
import {
  type ChatTransport,
  convertToModelMessages,
  isToolUIPart,
  simulateReadableStream,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessageChunk,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import type { ChatMessage } from "./chat-message";
import { tools } from "./tools";

/**
 * The claim in the piece, run against the real SDK: when a tool needs
 * approval, the server has nothing more to say, so the stream closes and
 * `status` goes back to `ready` while the part sits in `approval-requested`.
 * The model is mocked; everything from `streamText` to `Chat` is the real code.
 */

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

const input = '{"path":"scratch/notes.md"}';

const model = new MockLanguageModelV4({
  doStream: [
    // First call: the model asks for the tool.
    {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "tool-input-start", id: "call-1", toolName: "deleteFile" },
          { type: "tool-input-delta", id: "call-1", delta: input },
          { type: "tool-input-end", id: "call-1" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "deleteFile",
            input,
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
          },
        ],
      }),
    },
    // Second call, after approval: the model answers with text.
    {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Deleted it." },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ],
      }),
    },
  ],
});

/** The route handler's logic, minus HTTP, with a tap that records chunk types. */
function makeTransport(
  log: UIMessageChunk["type"][],
): ChatTransport<ChatMessage> {
  return {
    sendMessages: async ({ messages }) => {
      const result = streamText({
        model,
        messages: await convertToModelMessages(messages),
        tools,
        toolApproval: { deleteFile: "user-approval" },
        stopWhen: stepCountIs(5),
      });
      return toUIMessageStream({ stream: result.stream }).pipeThrough(
        new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform: (chunk, controller) => {
            log.push(chunk.type);
            controller.enqueue(chunk);
          },
        }),
      );
    },
    reconnectToStream: async () => null,
  };
}

test("an approval request closes the stream and leaves status at ready", async () => {
  const log: UIMessageChunk["type"][] = [];
  const chat = new Chat<ChatMessage>({ transport: makeTransport(log) });

  const seen: string[] = [];
  chat["~registerStatusCallback"](() => seen.push(chat.status));

  await chat.sendMessage({ text: "Delete scratch/notes.md" });

  // The wire: the step finishes and the message finishes, with the part still waiting.
  expect(log).toEqual([
    "start",
    "start-step",
    "tool-input-start",
    "tool-input-delta",
    "tool-input-available",
    "tool-approval-request",
    "finish-step",
    "finish",
  ]);

  // The coarse machine went all the way round.
  expect(seen).toEqual(["submitted", "streaming", "ready"]);
  expect(chat.status).toBe("ready");

  // The fine machine is the only thing that knows the turn is paused.
  const part = chat.lastMessage?.parts.find(isToolUIPart);
  expect(part?.state).toBe("approval-requested");
  if (part?.state !== "approval-requested") throw new Error("unreachable");

  // Answering flips the part and does not touch status.
  await chat.addToolApprovalResponse({ id: part.approval.id, approved: true });
  expect(chat.lastMessage?.parts.find(isToolUIPart)?.state).toBe(
    "approval-responded",
  );
  expect(chat.status).toBe("ready");

  // Nothing happens until the app continues. `sendMessage()` with no
  // argument resumes from the pending approval: the tool runs, then the model.
  log.length = 0;
  await chat.sendMessage();

  expect(log).toEqual([
    "start",
    "tool-output-available",
    "start-step",
    "text-start",
    "text-delta",
    "text-end",
    "finish-step",
    "finish",
  ]);
  const after = chat.lastMessage?.parts.find(isToolUIPart);
  expect(after?.state).toBe("output-available");
  expect(after?.output).toEqual({ deleted: "scratch/notes.md" });
  expect(chat.lastMessage?.parts.at(-1)).toMatchObject({
    type: "text",
    state: "done",
  });
  expect(chat.status).toBe("ready");
}, 15_000);
