import { getListeningTracker } from "../services/listeningTracker";
import { getSpicetify } from "../utils/spicetify";

/**
 * Statswin extension entry point.
 *
 * Owns the singleton tracker lifecycle so the CustomApp view can mount and
 * unmount without interrupting session recording.
 */
(async function onStartup(): Promise<void> {
  while (!getSpicetify()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const tracker = getListeningTracker();
  if (!tracker.isRunning()) tracker.start();

  // The app view and the tracker both run in the same context; make sure a
  // pending flush never loses the current segment.
  window.addEventListener("pagehide", () => tracker.flush());
})();
