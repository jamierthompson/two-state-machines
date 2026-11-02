"use client";

import type { ChatStatus } from "ai";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/lib/chat-message";
import type { WireEntry } from "@/lib/logging-transport";

const STATUSES: ChatStatus[] = ["ready", "submitted", "streaming", "error"];

export type Transition = { status: ChatStatus; at: number };

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Flag({ name, value }: { name: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 font-mono text-xs">
      <span className="text-muted-foreground">{name}</span>
      <span data-value={value} data-testid={`flag-${name}`}>
        {String(value)}
      </span>
    </div>
  );
}

/** The coarse machine: one value for the whole chat, and what the composer derives from it. */
export function StatusPanel({
  status,
  transitions,
  showStop,
  awaitingApproval,
}: {
  status: ChatStatus;
  transitions: Transition[];
  showStop: boolean;
  awaitingApproval: boolean;
}) {
  const first = transitions[0]?.at ?? 0;
  return (
    <Panel title="status">
      <div
        className="flex flex-wrap gap-1.5"
        data-testid="status"
        data-status={status}
      >
        {STATUSES.map((value) => (
          <Badge
            key={value}
            variant={value === status ? "default" : "outline"}
            className="font-mono"
          >
            {value}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-md border bg-card p-3">
        <Flag name="showStop" value={showStop} />
        <Flag name="awaitingApproval" value={awaitingApproval} />
      </div>
      <ol className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
        {transitions.slice(-8).map((transition, index, list) => {
          const previous = list[index - 1];
          return (
            <li key={transition.at} className="flex justify-between gap-3">
              <span>
                {previous ? `${previous.status} → ` : ""}
                <span className="text-foreground">{transition.status}</span>
              </span>
              <span className="tabular-nums">+{transition.at - first}ms</span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function partState(part: ChatMessage["parts"][number]) {
  if ("state" in part && part.state) return part.state;
  return "";
}

function partDetail(part: ChatMessage["parts"][number]) {
  if (part.type === "text" || part.type === "reasoning") {
    return `${part.text.length} chars`;
  }
  if (part.type === "custom") {
    return part.kind;
  }
  if (part.type.startsWith("tool-")) {
    const tool = part as Extract<typeof part, { toolCallId: string }>;
    if ("approval" in tool && tool.approval && "approved" in tool.approval) {
      return `approved: ${String(tool.approval.approved)}`;
    }
    return tool.toolCallId.slice(0, 12);
  }
  return "";
}

/** The fine machine: every part of the latest assistant message, with its own state. */
export function PartsPanel({ message }: { message: ChatMessage | undefined }) {
  return (
    <Panel title="parts of the last assistant message">
      {message ? (
        <ol
          className="flex flex-col gap-1 font-mono text-xs"
          data-testid="parts"
        >
          {message.parts.map((part, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: parts have no id; order is stable
              key={index}
              className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2"
            >
              <span className="text-muted-foreground">{index}</span>
              <span className="truncate">
                {part.type}
                <span className="text-muted-foreground">
                  {" "}
                  {partDetail(part)}
                </span>
              </span>
              {partState(part) ? (
                <Badge
                  variant="secondary"
                  className="font-mono"
                  data-state={partState(part)}
                >
                  {partState(part)}
                </Badge>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">
          No assistant message yet. Until the first chunk arrives there is no
          part to ask, which is why the thinking indicator is the one thing that
          reads <code>status</code>.
        </p>
      )}
    </Panel>
  );
}

function chunkDetail(chunk: Extract<WireEntry, { kind: "chunk" }>["chunk"]) {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return JSON.stringify(chunk.delta.slice(0, 24));
    case "tool-input-start":
      return chunk.toolName;
    case "tool-input-delta":
      return JSON.stringify(chunk.inputTextDelta.slice(0, 24));
    case "tool-input-available":
      return `${chunk.toolName} ${JSON.stringify(chunk.input)}`;
    case "tool-approval-request":
      return chunk.approvalId;
    case "tool-output-available":
      return JSON.stringify(chunk.output).slice(0, 40);
    case "finish":
      return chunk.finishReason ?? "";
    case "error":
      return chunk.errorText;
    case "custom":
      return chunk.kind;
    default:
      return "";
  }
}

/** The wire: every chunk the transport handed to `useChat`, in order. */
export function WirePanel({ entries }: { entries: WireEntry[] }) {
  const listRef = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    const list = listRef.current;
    if (list && entries.length) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  return (
    <Panel title="wire">
      <ol
        ref={listRef}
        data-testid="wire"
        className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border bg-card p-3 font-mono text-xs lg:max-h-none lg:flex-1"
      >
        {entries.length === 0 && (
          <li className="text-muted-foreground">Nothing sent yet.</li>
        )}
        {entries.map((entry) => {
          if (entry.kind === "request") {
            return (
              <li
                key={entry.at}
                className="mt-2 border-t pt-2 text-muted-foreground first:mt-0 first:border-t-0 first:pt-0"
              >
                POST /api/chat · {entry.trigger}
              </li>
            );
          }
          if (entry.kind === "close") {
            return (
              <li key={entry.at} className="text-muted-foreground">
                stream closed
              </li>
            );
          }
          return (
            <li
              key={`${entry.at}-${entry.chunk.type}`}
              className="grid grid-cols-[auto_1fr] gap-2"
            >
              <span>{entry.chunk.type}</span>
              <span className="truncate text-muted-foreground">
                {chunkDetail(entry.chunk)}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
