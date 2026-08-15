import { NextRequest } from "next/server";
import {
  handleApiError,
  isNextResponse,
  jsonError,
  jsonOk,
  requireMapsWorkspaceMember,
} from "@/lib/maps/api-auth";
import { geocodeAddress } from "@/lib/maps/geocode";
import { geocodeSchema } from "@/lib/maps/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId =
      (body.workspaceId as string | undefined) ??
      req.nextUrl.searchParams.get("workspaceId");
    const auth = await requireMapsWorkspaceMember(workspaceId);
    if (isNextResponse(auth)) return auth;

    const parsed = geocodeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Address is required");
    }

    const result = await geocodeAddress(parsed.data.address);
    if (!result) {
      return jsonError("No results found for that address", 404);
    }

    return jsonOk({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
