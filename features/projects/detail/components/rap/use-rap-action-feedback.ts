"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

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
