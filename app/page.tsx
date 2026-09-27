import { Play } from "@/components/Play";
import { getBoard } from "@/lib/state";

export const revalidate = 300;

export default async function Home() {
  const board = await getBoard();
  return <Play initial={board} />;
}
