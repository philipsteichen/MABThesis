const ENDPOINT = "/api/analytics/event";

export function trackEvent(event: string, page: string, detail?: string) {
  // Fire-and-forget – never block the UI
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, page, detail }),
  }).catch(() => {
    // silently ignore analytics failures
  });
}

export function trackPageView(page: string) {
  trackEvent("page_view", page);
}

export function trackClick(page: string, detail: string) {
  trackEvent("click", page, detail);
}

export function trackUpload(page: string, filename: string) {
  trackEvent("csv_upload", page, filename);
}
