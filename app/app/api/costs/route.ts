import { monthUsage } from "@/lib/costs";

export async function GET() {
  const usage = await monthUsage();
  return Response.json(usage);
}
