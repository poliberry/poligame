import React from "react";
import { useLocation } from "react-router-dom";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AddCustomAppDialog } from "@/components/AddCustomAppDialog";
import { DeleteCustomAppDialog } from "@/components/DeleteCustomAppDialog";

type DialogAction = "add" | "delete";

const CustomAppDialogWindow: React.FC = () => {
  const location = useLocation();

  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const action = (params.get("action") || "add") as DialogAction;
  const gameId = params.get("gameId") || "";
  const name = params.get("name") || "";

  const closeWindow = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.debug("Unable to close custom app dialog window", error);
    }
  };

  const notifyUpdated = async () => {
    try {
      await emit("custom-app-updated", {
        action,
        gameId,
      });
    } catch (error) {
      console.debug("Unable to emit custom app update event", error);
    }
  };

  if (action === "delete") {
    if (!gameId || !name) {
      return null;
    }

    return (
      <DeleteCustomAppDialog
        isOpen
        onClose={closeWindow}
        gameId={gameId}
        appName={name}
        onSuccess={notifyUpdated}
        standaloneWindow
      />
    );
  }

  return (
    <AddCustomAppDialog
      isOpen
      onClose={closeWindow}
      onSuccess={notifyUpdated}
      standaloneWindow
    />
  );
};

export default CustomAppDialogWindow;
