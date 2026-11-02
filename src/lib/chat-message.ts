import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { tools } from "./tools";

/** The message type shared by the route, `useChat` and every renderer. */
export type ChatMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<typeof tools>
>;

export type ChatPart = ChatMessage["parts"][number];
