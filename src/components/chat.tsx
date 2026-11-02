"use client";

import { useChat } from "@ai-sdk/react";
import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { ArrowUpIcon, RotateCwIcon, SquareIcon } from "lucide-react";
import * as React from "react";
import {
  PartsPanel,
  StatusPanel,
  type Transition,
  WirePanel,
} from "@/components/instruments";
import { AssistantMessage, UserMessage } from "@/components/thread";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Trace, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { ChatMessage } from "@/lib/chat-message";
import { LoggingTransport, type WireEntry } from "@/lib/logging-transport";

const SUGGESTIONS = [
  "What's the weather in Reykjavík?",
  "Delete scratch/notes.md",
  "Say hello in one sentence.",
];

export function Chat() {
  const [wire, setWire] = React.useState<WireEntry[]>([]);
  const [transport] = React.useState(
    () =>
      new LoggingTransport<ChatMessage>((entry) =>
        setWire((log) => [...log.slice(-299), entry]),
      ),
  );

  // `sendAutomaticallyWhen` is read through a ref so the checkbox can change
  // it without recreating the chat.
  const [autoContinue, setAutoContinue] = React.useState(true);
  const autoContinueRef = React.useRef(autoContinue);
  autoContinueRef.current = autoContinue;

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    error,
    clearError,
    addToolApprovalResponse,
    setMessages,
  } = useChat<ChatMessage>({
    transport,
    sendAutomaticallyWhen: (options) =>
      autoContinueRef.current &&
      lastAssistantMessageIsCompleteWithApprovalResponses(options),
  });

  const [transitions, setTransitions] = React.useState<Transition[]>([]);
  React.useEffect(() => {
    setTransitions((log) => [...log.slice(-11), { status, at: Date.now() }]);
  }, [status]);

  const [draft, setDraft] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  // The coarse machine, read once, here.
  const busy = status === "submitted" || status === "streaming";
  const showStop = busy;

  // The one place the composer has to look one level down.
  const last = messages.at(-1);
  const lastAssistant = last?.role === "assistant" ? last : undefined;
  const awaitingApproval =
    lastAssistant?.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-requested",
    ) ?? false;
  const canContinue =
    !busy &&
    !autoContinue &&
    (lastAssistant?.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-responded",
    ) ??
      false);

  const canSend = draft.trim().length > 0 && !busy;

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setDraft("");
  }

  return (
    <MessageScrollerProvider autoScroll>
      <div className="grid min-h-dvh grid-cols-1 lg:h-dvh lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex min-h-0 flex-col lg:border-r">
          <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-medium">
                The two state machines inside useChat
              </h1>
              <p className="text-sm text-muted-foreground">
                A real turn, with the status and every part state shown beside
                it.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Reset conversation"
              disabled={busy}
              onClick={() => {
                setMessages([]);
                setWire([]);
                setTransitions([]);
                clearError();
              }}
            >
              <RotateCwIcon />
            </Button>
          </header>

          <div className="min-h-0 flex-1 lg:flex lg:flex-col">
            <MessageScroller className="h-[60dvh] lg:h-auto lg:flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent
                  aria-busy={busy}
                  className="gap-6 px-6 py-6"
                >
                  {messages.length === 0 && (
                    <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
                      Pick a prompt below. The weather tool runs on its own; the
                      delete tool asks you first, which is where the coarse
                      status is not enough.
                    </p>
                  )}
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      {message.role === "user" ? (
                        <UserMessage message={message} />
                      ) : (
                        <AssistantMessage
                          message={message}
                          streaming={busy && message === last}
                          onApproval={addToolApprovalResponse}
                        />
                      )}
                    </MessageScrollerItem>
                  ))}
                  {/* The one exception: the assistant message does not exist yet, so there is no part to ask. */}
                  {status === "submitted" && (
                    <Trace>
                      <TraceLine status="running">
                        <TraceTitle>Waiting for the first chunk</TraceTitle>
                      </TraceLine>
                    </Trace>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </div>

          <div className="flex flex-col gap-3 border-t px-6 py-4">
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                <span className="truncate">{error.message}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => regenerate()}
                >
                  Retry
                </Button>
              </div>
            )}
            {canContinue && (
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span>
                  Approval answered. Nothing happens until the app continues the
                  turn.
                </span>
                <Button size="sm" onClick={() => sendMessage()}>
                  Continue
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
            <form
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
            >
              <InputGroup>
                <InputGroupTextarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask something…"
                  aria-label="Message"
                  className="min-h-12 p-3"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                />
                <InputGroupAddon align="block-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoContinue}
                      onChange={(event) =>
                        setAutoContinue(event.target.checked)
                      }
                      className="accent-foreground"
                    />
                    Continue automatically after approval
                  </label>
                  {showStop ? (
                    <InputGroupButton
                      type="button"
                      variant="default"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label="Stop"
                      data-testid="stop"
                      onClick={() => stop()}
                    >
                      <SquareIcon />
                    </InputGroupButton>
                  ) : (
                    <InputGroupButton
                      type="submit"
                      variant="default"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label="Send"
                      data-testid="send"
                      disabled={!canSend}
                    >
                      <ArrowUpIcon />
                    </InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
            </form>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-8 overflow-y-auto bg-muted/30 px-6 py-6">
          <StatusPanel
            status={status}
            transitions={transitions}
            showStop={showStop}
            awaitingApproval={awaitingApproval}
          />
          <PartsPanel message={lastAssistant} />
          <WirePanel entries={wire} />
        </aside>
      </div>
    </MessageScrollerProvider>
  );
}
