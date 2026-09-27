import { warmAfter } from "@/lib/rounds";
import { getBoard } from "@/lib/state";

export const revalidate = 60;
export const maxDuration = 300;

export async function GET() {
  warmAfter();
  return Response.json(await getBoard());
}
