import type { createInventoryLocation as CreateInventoryLocation } from "@/app/actions/material/warehouse";

/** This visual fixture never calls the backend or creates an inventory location. */
export async function createInventoryLocation(
  ..._args: Parameters<typeof CreateInventoryLocation>
): Promise<Awaited<ReturnType<typeof CreateInventoryLocation>>> {
  void _args;
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Fixture UI tidak menyimpan lokasi inventory." },
  };
}
