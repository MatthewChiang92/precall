import { after } from "next/server";
import { Play } from "@/components/Play";
import { refreshAll } from "@/lib/rounds";
import { getBoard } from "@/lib/state";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Home() {
  // Keep prices and settlement warm without making the visitor wait for upstream APIs.
  after(() => refreshAll().catch((e) => console.error("refresh", e)));
  const board = await getBoard();
  return <Play initial={board} />;
}
