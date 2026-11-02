/** The model the route uses unless AI_GATEWAY_MODEL is set. Cheap, supports tools and reasoning. */
export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

export const model = () => process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
