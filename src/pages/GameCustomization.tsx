import React from "react";
import { useParams } from "react-router-dom";
import { GameCustomizationWindow } from "@/components/GameCustomizationWindow";

export const GameCustomization: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();

  if (!gameId) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white">
        <div>Game ID not found</div>
      </div>
    );
  }

  const handleClose = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_game_customization_window");
    } catch (err) {
      console.error("Error closing window:", err);
    }
  };

  return <GameCustomizationWindow gameId={gameId} onClose={handleClose} />;
};

