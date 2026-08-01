import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;
export const isPostHogInitialized = Boolean(posthogKey && posthogHost);

if (isPostHogInitialized) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
  });
  posthog.startExceptionAutocapture({
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  });
} else if (import.meta.env.DEV) {
  const missingVariable = !posthogKey
    ? "VITE_POSTHOG_KEY"
    : "VITE_POSTHOG_HOST";
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
  );
}

export { posthog };
