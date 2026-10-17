"use client";

import { useState } from "react";
import { toast } from "sonner";

export function useRapActionFeedback(): {
  readonly error: string | null;
  readonly success: string | null;
  readonly resetMessages: () => void;
  readonly showError: (message: string) => void;
  readonly showSuccess: (message: string) => void;
} {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return {
    error,
    success,
    resetMessages: () => {
      setError(null);
      setSuccess(null);
    },
    showError: (message) => {
      setError(message);
      toast.error(message);
    },
    showSuccess: (message) => {
      setSuccess(message);
      toast.success(message);
    },
  };
}
