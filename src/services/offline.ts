export const isOnline = () => navigator.onLine;

export const queueAction = (action) => {
  const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    queue.push(action);
      localStorage.setItem("offlineQueue", JSON.stringify(queue));
      };

      export const syncQueue = async () => {
        if (!isOnline()) return;

          const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");

            for (const item of queue) {
                try {
                      await fetch(item.url, {
                              method: item.method,
                                      body: JSON.stringify(item.body),
                                              headers: { "Content-Type": "application/json" },
                                                    }); 
                                                        } catch {}
                                                          }

                                                            localStorage.removeItem("offlineQueue");
                                                            };
