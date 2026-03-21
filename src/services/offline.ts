type OfflineAction = {
  url: string;
  method: string;
  body?: unknown;
};

export const isOnline = (): boolean => navigator.onLine;

export const queueAction = (action: OfflineAction): void => {
  const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]") as OfflineAction[];
  queue.push(action);
  localStorage.setItem("offlineQueue", JSON.stringify(queue));
};

export const syncQueue = async (): Promise<void> => {
  if (!isOnline()) return;

  const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]") as OfflineAction[];

  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        body: item.body ? JSON.stringify(item.body) : undefined,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to sync offline action", error);
    }
  }

  localStorage.removeItem("offlineQueue");
};
