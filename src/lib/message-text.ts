import type { UIMessage } from "ai";

/** The text parts of a message joined, for the user bubble and the parts panel. */
export function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
