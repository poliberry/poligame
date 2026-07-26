import React from "react";
import { NovuProvider as NovuProviderComponent } from "@novu/react";
import { useAuthStore } from "@/stores/authStore";

interface NovuProviderWrapperProps {
  children: React.ReactNode;
}

export const NovuProviderWrapper: React.FC<NovuProviderWrapperProps> = ({ children }) => {
  const { user } = useAuthStore();
  const applicationIdentifier =
    import.meta.env.VITE_NOVU_APPLICATION_IDENTIFIER ||
    import.meta.env.VITE_NOVU_APP_ID;

  // Only wrap with NovuProvider if we have a subscriber ID and app ID
  if (!applicationIdentifier) {
    console.warn(
      "Missing Novu app identifier. Set VITE_NOVU_APPLICATION_IDENTIFIER (or VITE_NOVU_APP_ID).",
    );
    return <>{children}</>;
  }

  if (!user?.novuSubscriberId) {
    // Render children without NovuProvider if subscriberId is not yet available
    // This prevents crashes during initial load or if user is not logged in
    return <>{children}</>;
  }

  return (
    <NovuProviderComponent
      subscriberId={user.novuSubscriberId}
      applicationIdentifier={applicationIdentifier}
    >
      {children}
    </NovuProviderComponent>
  );
};

