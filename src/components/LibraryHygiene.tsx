import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useGameStore } from "@/stores/gameStore";

interface DuplicateGroup {
  games: Array<{
    id: string;
    title: string;
    launcher: string;
    install_path?: string;
    launcher_game_id: string;
  }>;
  reason: string;
}

export const LibraryHygiene: React.FC = () => {
  const { setGames } = useGameStore();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const found = await invoke<DuplicateGroup[]>("find_duplicate_games");
      setDuplicates(found);
      if (found.length === 0) {
        toast.success("No duplicates found!", {
          description: "Your library is clean.",
        });
      } else {
        toast.info(`Found ${found.length} duplicate group(s)`, {
          description: `Total ${found.reduce((sum, g) => sum + g.games.length, 0)} duplicate games found.`,
        });
      }
    } catch (error: any) {
      toast.error("Failed to scan for duplicates", {
        description: error.message || "An error occurred",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const removeDuplicates = async () => {
    if (duplicates.length === 0) return;

    setIsRemoving(true);
    try {
      const removedCount = await invoke<number>("remove_duplicate_games", {
        duplicateGroups: duplicates,
      });

      // Reload games
      const gameList = await invoke<any[]>("get_all_games");
      setGames(gameList);

      toast.success(`Removed ${removedCount} duplicate game(s)`, {
        description: "Your library has been cleaned up.",
      });

      setDuplicates([]);
    } catch (error: any) {
      toast.error("Failed to remove duplicates", {
        description: error.message || "An error occurred",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Library Hygiene
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan your library for duplicate games and remove them to keep your library clean.
        </p>

        <div className="flex gap-2">
          <Button
            onClick={scanForDuplicates}
            disabled={isScanning || isRemoving}
            variant="default"
          >
            <Search className="mr-2 h-4 w-4" />
            {isScanning ? "Scanning..." : "Scan for Duplicates"}
          </Button>

          {duplicates.length > 0 && (
            <Button
              onClick={removeDuplicates}
              disabled={isRemoving || isScanning}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isRemoving ? "Removing..." : `Remove ${duplicates.reduce((sum, g) => sum + g.games.length - 1, 0)} Duplicate(s)`}
            </Button>
          )}
        </div>

        {duplicates.length > 0 && (
          <div className="space-y-4 mt-4">
            <p className="text-sm font-medium">
              Found {duplicates.length} duplicate group(s):
            </p>
            {duplicates.map((group, idx) => (
              <Card key={idx} className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{group.reason}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {group.games.length} duplicate(s)
                    </span>
                  </div>
                  <div className="space-y-2 mt-2">
                    {group.games.map((game, gameIdx) => (
                      <div
                        key={game.id}
                        className={`flex items-center justify-between p-2 rounded ${
                          gameIdx === 0
                            ? "bg-primary/10 border border-primary/20"
                            : "bg-background/50"
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{game.title}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{game.launcher}</span>
                            {game.install_path && (
                              <span className="truncate max-w-xs">
                                {game.install_path}
                              </span>
                            )}
                          </div>
                        </div>
                        {gameIdx === 0 && (
                          <Badge variant="default" className="ml-2">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Keeping
                          </Badge>
                        )}
                        {gameIdx > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            Removing
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

