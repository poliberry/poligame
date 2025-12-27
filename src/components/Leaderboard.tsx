import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Trophy, Medal, Award } from "lucide-react";
import { MicaCard } from "@/components/MicaCard";

interface LeaderboardProps {
  gameId?: string; // If provided, show game-specific leaderboard
  limit?: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ gameId, limit = 10 }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xpApi = api as any;
  
  const leaderboard = useQuery(
    gameId
      ? xpApi.xp?.getGameLeaderboard
      : xpApi.xp?.getLeaderboard,
    gameId
      ? { gameId, limit }
      : { limit }
  );

  if (!leaderboard) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-foreground/60">Loading leaderboard...</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <MicaCard className="p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-foreground/40" />
        <p className="text-foreground/60" style={{ fontFamily: 'Livvic, sans-serif' }}>
          No leaderboard data yet
        </p>
      </MicaCard>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-foreground/60 font-bold">#{rank}</span>;
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold uppercase italic mb-2" style={{ fontFamily: 'Unbounded, sans-serif' }}>
        {gameId ? "Game Leaderboard" : "Global Leaderboard"}
      </h2>
      <div className="flex flex-col gap-2">
        {leaderboard.map((entry: any) => (
          <MicaCard
            key={entry.userId}
            className={`p-3 flex items-center gap-3 ${
              entry.rank <= 3 ? "border-2 border-[var(--theme-accent)]/50" : ""
            }`}
          >
            <div className="flex items-center justify-center w-8">
              {getRankIcon(entry.rank)}
            </div>
            {entry.avatar ? (
              <img
                src={entry.avatar}
                alt={entry.username}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/20 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">
                  {(entry.username || "U")[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate" style={{ fontFamily: 'Livvic, sans-serif' }}>
                {entry.username}
              </p>
              {entry.level && (
                <p className="text-xs text-foreground/60" style={{ fontFamily: 'Livvic, sans-serif' }}>
                  Level {entry.level}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-[var(--theme-accent)]" />
                <span className="font-bold text-foreground" style={{ fontFamily: 'Livvic, sans-serif' }}>
                  {gameId ? entry.gameXP?.toLocaleString() : entry.totalXP?.toLocaleString()}
                </span>
              </div>
              {gameId && entry.gameXP && (
                <span className="text-xs text-foreground/60" style={{ fontFamily: 'Livvic, sans-serif' }}>
                  {Math.floor(entry.gameXP / 3600)}h {Math.floor((entry.gameXP % 3600) / 60)}m
                </span>
              )}
            </div>
          </MicaCard>
        ))}
      </div>
    </div>
  );
};

