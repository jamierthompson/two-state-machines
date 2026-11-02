import { KeyRoundIcon } from "lucide-react";
import { Chat } from "@/components/chat";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { model } from "@/lib/model";

export default function Home() {
  const hasCredentials = Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
  );

  return (
    <>
      {!hasCredentials && (
        <Item variant="muted" size="sm" className="rounded-none border-b">
          <ItemMedia variant="icon">
            <KeyRoundIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>No AI Gateway credentials</ItemTitle>
            <ItemDescription>
              Put an <code>AI_GATEWAY_API_KEY</code> in <code>.env.local</code>{" "}
              (see <code>.env.example</code>) and restart. Requests will fail
              until then.
            </ItemDescription>
          </ItemContent>
        </Item>
      )}
      <Chat />
      <p className="sr-only">Model: {model()}</p>
    </>
  );
}
