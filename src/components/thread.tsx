"use client";

import {
  CircleCheckIcon,
  CloudSunIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Message, MessageContent } from "@/components/ui/message";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { ChatMessage, ChatPart } from "@/lib/chat-message";
import { getMessageText } from "@/lib/message-text";

type ToolPart = Extract<
  ChatPart,
  { type: "tool-getWeather" | "tool-deleteFile" }
>;

type Approve = (response: { id: string; approved: boolean }) => void;

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end" variant="muted">
          <BubbleContent>{getMessageText(message)}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/**
 * The assistant turn, rendered part by part. Every branch below switches on
 * `part.type` and then `part.state`; nothing reads the text to decide how to
 * draw it.
 */
export function AssistantMessage({
  message,
  streaming,
  onApproval,
}: {
  message: ChatMessage;
  streaming: boolean;
  onApproval: Approve;
}) {
  return (
    <Message>
      <MessageContent className="gap-3">
        {message.parts.map((part, index) => {
          // Parts carry no stable id of their own; order within a message is stable.
          const key = `${message.id}-${index}`;

          if (part.type === "text") {
            return (
              <p
                key={key}
                data-state={part.state}
                className="text-sm leading-relaxed whitespace-pre-wrap data-[state=streaming]:after:ml-0.5 data-[state=streaming]:after:inline-block data-[state=streaming]:after:h-[1em] data-[state=streaming]:after:w-[0.5em] data-[state=streaming]:after:translate-y-[0.15em] data-[state=streaming]:after:animate-pulse data-[state=streaming]:after:bg-foreground data-[state=streaming]:after:content-['']"
              >
                {part.text}
              </p>
            );
          }

          if (part.type === "reasoning") {
            return (
              <Trace key={key}>
                <ReasoningLine
                  text={part.text}
                  running={part.state === "streaming"}
                />
              </Trace>
            );
          }

          if (
            part.type === "tool-getWeather" ||
            part.type === "tool-deleteFile"
          ) {
            return (
              <ToolBlock
                key={part.toolCallId}
                part={part}
                streaming={streaming}
                onApproval={onApproval}
              />
            );
          }

          return null;
        })}
      </MessageContent>
    </Message>
  );
}

function ReasoningLine({ text, running }: { text: string; running: boolean }) {
  const [open, setOpen] = React.useState<boolean>();

  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceIcon>
        {running ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <CircleCheckIcon />
        )}
      </TraceIcon>
      <TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
    </TraceLine>
  );

  if (text.length === 0) return line;

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function labelFor(part: ToolPart) {
  if (part.type === "tool-getWeather") {
    const city = part.input?.city;
    return {
      icon: <CloudSunIcon />,
      verb: ["Checking", "Checked"],
      object: city ? `weather in ${city}` : "weather",
    };
  }
  return {
    icon: <Trash2Icon />,
    verb: ["Deleting", "Deleted"],
    object: part.input?.path ?? "a file",
  };
}

function ToolBlock({
  part,
  streaming,
  onApproval,
}: {
  part: ToolPart;
  streaming: boolean;
  onApproval: Approve;
}) {
  const { icon, verb, object } = labelFor(part);

  // A pending approval is a question for the person, not a step the agent
  // took, so it is an Item outside the Trace.
  if (part.state === "approval-requested") {
    return (
      <Item variant="outline" size="sm" data-testid="approval-card">
        <ItemMedia variant="icon">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>
            {verb[0].replace(/ing$/, "e")} {object}?
          </ItemTitle>
          <ItemDescription>
            Nothing is really deleted. The tool is a mock.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onApproval({ id: part.approval.id, approved: false })
            }
          >
            Deny
          </Button>
          <Button
            size="sm"
            onClick={() => onApproval({ id: part.approval.id, approved: true })}
          >
            Approve
          </Button>
        </ItemActions>
      </Item>
    );
  }

  const denied =
    part.state === "output-denied" ||
    (part.state === "approval-responded" && !part.approval.approved);
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  const running = !denied && !failed && !done && streaming;

  const title = denied
    ? `Denied: ${object}`
    : failed
      ? `Failed: ${object}`
      : done
        ? `${verb[1]} ${object}`
        : running
          ? `${verb[0]} ${object}`
          : `Waiting: ${object}`;

  const output = done
    ? JSON.stringify(part.output)
    : failed
      ? part.errorText
      : undefined;

  const line = (
    <TraceLine status={failed ? "error" : running ? "running" : undefined}>
      <TraceIcon>{icon}</TraceIcon>
      <TraceTitle>{title}</TraceTitle>
    </TraceLine>
  );

  return (
    <Trace>
      {output ? (
        <TraceCollapsible>
          <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="font-mono text-xs">
            {output}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      ) : (
        line
      )}
    </Trace>
  );
}
