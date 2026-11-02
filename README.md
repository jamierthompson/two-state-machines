# The two state machines inside useChat

A live companion to [the piece of the same name](https://jamiethompson.dev/writing/two-state-machines-inside-use-chat/),
running at [two-state-machines.vercel.app](https://two-state-machines.vercel.app).
One real chat turn, with instruments beside it: the four-value `status`, the
state on every part of the latest assistant message, and every chunk the
transport hands to `useChat`.

## Stack

Next.js 16 (App Router) · React 19 · AI SDK 7 with `useChat` · Vercel AI
Gateway · shadcn/ui (Base UI) with the AI Elements patterns · Tailwind CSS 4 ·
TypeScript 7 · Biome (lint) · Prettier (format) · Vitest · Playwright

## Run it

Needs Node 24 (see `.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then add an AI Gateway key
pnpm dev
```

Create a key with `vercel ai-gateway api-keys create --name two-state-machines`
and put it in `.env.local` as `AI_GATEWAY_API_KEY`. The model defaults to
`anthropic/claude-haiku-5.5`; set `AI_GATEWAY_MODEL` to any
`provider/model` id from the gateway that supports tools and reasoning.

## What to try

- **Weather** runs a tool with no approval: watch the tool part walk
  `input-streaming → input-available → output-available`.
- **Delete** runs a tool gated by `toolApproval`. The stream closes while the
  part sits in `approval-requested`, so `status` is `ready` and the composer
  shows Send. Untick "Continue automatically" to see that nothing resumes
  until the app calls `sendMessage()` with no arguments.
- **Stop** mid-stream: the partial parts stay, and `status` returns to `ready`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # the approval pause, against the real SDK with a mock model
pnpm test:e2e    # the same flow in the browser, with a canned stream
```

Neither suite needs a gateway key: the unit test runs against a mock model
and the e2e test intercepts `/api/chat`. Playwright needs its browser once:
`pnpm exec playwright install chromium`.

## Structure

- `src/app/api/chat/route.ts`: `streamText` with two mock tools, one behind approval.
- `src/lib/tools.ts`: the two tools. Nothing real happens; the delays make the states visible.
- `src/lib/model.ts`: the default model, overridable with `AI_GATEWAY_MODEL`.
- `src/lib/logging-transport.ts`: the default transport with a tap for the wire panel.
- `src/components/chat.tsx`: `useChat`, the composer, and the one derivation that looks one level down.
- `src/components/thread.tsx`: parts rendered by `type` then `state`.
- `src/components/instruments.tsx`: the status, parts, and wire panels.

## License

[MIT](LICENSE)
