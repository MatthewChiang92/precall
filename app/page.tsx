import { Play } from "@/components/Play";
import { warmAfter } from "@/lib/rounds";
import { getBoard } from "@/lib/state";

export const revalidate = 300;
export const maxDuration = 300;

export default async function Home() {
  warmAfter();
  const board = await getBoard();
  return <Play initial={board} />;
}
