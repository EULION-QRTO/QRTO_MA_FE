import { useEffect, useState } from "react";
import { applyUpdate, hasWaitingWorker, subscribeSwUpdate } from "@/lib/swUpdate";

export function useSwUpdate(): { updateAvailable: boolean; applyUpdate: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(() => hasWaitingWorker());

  useEffect(() => subscribeSwUpdate(setUpdateAvailable), []);

  return { updateAvailable, applyUpdate };
}
