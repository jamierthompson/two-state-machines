import { tool } from "ai";
import { z } from "zod";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A small, stable number derived from a string, so a city always gets the same weather. */
function hash(input: string) {
  let value = 0;
  for (const char of input) value = (value * 31 + char.charCodeAt(0)) % 1000;
  return value;
}

const conditions = ["clear", "overcast", "drizzle", "windy", "fog"] as const;

/**
 * Two mock tools, chosen so a single turn can show every tool-part state.
 *
 * `getWeather` runs on its own. `deleteFile` is gated behind the person's
 * approval in the route (`toolApproval`), which is what makes the stream
 * close while the part sits in `approval-requested`. Neither touches
 * anything real; the delays exist so the intermediate states are visible.
 */
export const tools = {
  getWeather: tool({
    description:
      "Get the current weather for a city. The data is made up but stable per city.",
    inputSchema: z.object({ city: z.string().describe("The city name") }),
    execute: async ({ city }) => {
      await wait(1500);
      const seed = hash(city.toLowerCase());
      return {
        city,
        temperatureC: (seed % 30) - 4,
        condition: conditions[seed % conditions.length],
      };
    },
  }),
  deleteFile: tool({
    description:
      "Delete a file from the workspace. Nothing is really deleted; this is a demo.",
    inputSchema: z.object({ path: z.string().describe("Path of the file") }),
    execute: async ({ path }) => {
      await wait(800);
      return { deleted: path };
    },
  }),
};
