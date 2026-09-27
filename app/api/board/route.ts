import { getBoard } from "@/lib/state";

export const revalidate = 60;

export async function GET() {
  return Response.json(await getBoard());
}
