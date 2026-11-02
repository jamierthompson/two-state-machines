import { DefaultChatTransport, type UIMessage, type UIMessageChunk } from "ai";

export type WireEntry =
  | { kind: "request"; trigger: string; at: number }
  | { kind: "chunk"; chunk: UIMessageChunk; at: number }
  | { kind: "close"; at: number };

/**
 * The default transport with a tap on the stream, so the page can show every
 * chunk as `useChat` applies it. It changes nothing about the chunks: each one
 * is logged and passed through.
 */
export class LoggingTransport<
  M extends UIMessage,
> extends DefaultChatTransport<M> {
  constructor(private readonly log: (entry: WireEntry) => void) {
    super({});
  }

  override async sendMessages(
    options: Parameters<DefaultChatTransport<M>["sendMessages"]>[0],
  ) {
    this.log({ kind: "request", trigger: options.trigger, at: Date.now() });
    const stream = await super.sendMessages(options);
    return stream.pipeThrough(
      new TransformStream<UIMessageChunk, UIMessageChunk>({
        transform: (chunk, controller) => {
          this.log({ kind: "chunk", chunk, at: Date.now() });
          controller.enqueue(chunk);
        },
        flush: () => this.log({ kind: "close", at: Date.now() }),
      }),
    );
  }
}
