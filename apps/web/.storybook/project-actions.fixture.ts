import type {
  createProjectAction as CreateProject,
  updateProjectAction as UpdateProject,
} from "@/app/actions/project/crud";

export async function createProjectAction(
  ..._args: Parameters<typeof CreateProject>
): Promise<Awaited<ReturnType<typeof CreateProject>>> {
  void _args;
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Fixture UI tidak menyimpan proyek." },
  };
}

export async function updateProjectAction(
  ..._args: Parameters<typeof UpdateProject>
): Promise<Awaited<ReturnType<typeof UpdateProject>>> {
  void _args;
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Fixture UI tidak mengubah proyek." },
  };
}
