"use client";

import { useCallback, useEffect, useState } from "react";
import { listBoxes } from "@/lib/soroban";
import { BookBox } from "@/lib/types";
import { isConfigured } from "@/lib/config";

export function useBoxes() {
  const [boxes, setBoxes] = useState<BookBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBoxes = useCallback(async () => {
    if (!isConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await listBoxes(0, 50);
      setBoxes(result);
    } catch {
      // Boxes are secondary data for the list-book form's dropdown;
      // a failure here shouldn't block the rest of the page, so we
      // just leave the list empty and let the modal show its own
      // "register a box first" prompt.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const refresh = useCallback(() => fetchBoxes(), [fetchBoxes]);

  return { boxes, isLoading, refresh };
}
