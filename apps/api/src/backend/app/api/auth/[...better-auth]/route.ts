import { auth } from "@backend/lib/auth";
function handler(request: Request): Promise<Response> {
  return auth.handler(request);
}

export { handler as GET, handler as POST };
