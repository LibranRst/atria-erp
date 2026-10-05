import {
  canUseTemporaryPasswordDuringDeveloperSimulation,
  isDeveloperAccountSimulationEnabled,
} from "@atria/core/auth/developer-account-simulation";

export type SessionAccessIdentity = {
  readonly isActive?: boolean;
  readonly mustChangePassword?: boolean;
  readonly roleId: string;
  readonly developerActorUserId?: string | null;
};

export type SessionAccessFailure = {
  readonly status: 401 | 403;
  readonly code: "UNAUTHORIZED" | "MUST_CHANGE_PASSWORD";
  readonly message: string;
};

/** Raw streaming routes enforce the same session gate as tRPC and web operations. */
export function sessionAccessFailure(identity: SessionAccessIdentity): SessionAccessFailure | null {
  if (identity.isActive === false) {
    return {
      status: 401,
      code: "UNAUTHORIZED",
      message: "Akun tidak aktif. Silakan masuk kembali.",
    };
  }
  const simulationAllowsPassword = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
    developerActorUserId: identity.developerActorUserId,
    effectiveRoleId: identity.roleId,
  });
  if (identity.mustChangePassword && !simulationAllowsPassword) {
    return {
      status: 403,
      code: "MUST_CHANGE_PASSWORD",
      message: "Ganti kata sandi sementara untuk melanjutkan.",
    };
  }
  return null;
}
