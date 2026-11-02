import { expect, test } from "@playwright/test";

/** A UI message stream body: one SSE event per chunk, then the terminator. */
function sse(chunks: object[]) {
  return [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`),
    "data: [DONE]\n\n",
  ].join("");
}

const approvalTurn = sse([
  { type: "start", messageId: "a1" },
  { type: "start-step" },
  { type: "tool-input-start", toolCallId: "call-1", toolName: "deleteFile" },
  {
    type: "tool-input-available",
    toolCallId: "call-1",
    toolName: "deleteFile",
    input: { path: "scratch/notes.md" },
  },
  {
    type: "tool-approval-request",
    toolCallId: "call-1",
    approvalId: "approval-1",
  },
  { type: "finish-step" },
  { type: "finish", finishReason: "tool-calls" },
]);

const continuation = sse([
  { type: "start", messageId: "a1" },
  {
    type: "tool-output-available",
    toolCallId: "call-1",
    output: { deleted: "scratch/notes.md" },
  },
  { type: "start-step" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: "Deleted it." },
  { type: "text-end", id: "t1" },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
]);

test("the composer shows Send while an approval waits, then the turn continues", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    calls += 1;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: calls === 1 ? approvalTurn : continuation,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Delete scratch/notes.md" }).click();

  const card = page.getByTestId("approval-card");
  await expect(card).toBeVisible();

  // The coarse status is back at ready; only the part knows the turn is paused.
  await expect(page.getByTestId("status")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await expect(page.getByTestId("flag-showStop")).toHaveText("false");
  await expect(page.getByTestId("flag-awaitingApproval")).toHaveText("true");
  await expect(page.getByTestId("send")).toBeVisible();
  await expect(page.getByTestId("parts")).toContainText("approval-requested");

  await card.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Deleted it.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("parts")).toContainText("output-available");
  await expect(page.getByTestId("flag-awaitingApproval")).toHaveText("false");
  expect(calls).toBe(2);
});
