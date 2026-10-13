"use client";

import { createAuthClient } from "better-auth/react";

/** Browser credentials stay on the admin origin through its /api/auth forwarding routes. */
export const authClient = createAuthClient();
