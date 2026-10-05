import { forwardToBackend } from "@/lib/api/forward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = forwardToBackend;
export const POST = forwardToBackend;
