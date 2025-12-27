import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface SystemRequirements {
  os?: string;
  processor?: string;
  memory?: string;
  graphics?: string;
  storage?: string;
  additional_notes?: string;
}

interface CompatibilityCheckerProps {
  gameId: string;
  gameTitle?: string;
  steamAppId?: string;
  launcher?: string; // "steam", "epic", "ea"
}


interface SystemInfo {
  os: string;
  os_version: string;
  cpu: string;
  ram_gb: number;
  gpu?: string;
  gpu_vram_gb?: number;
}

export const CompatibilityChecker: React.FC<CompatibilityCheckerProps> = ({
  gameId,
  gameTitle,
  steamAppId,
  launcher,
}) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [requirements, setRequirements] = useState<{ minimum?: SystemRequirements; recommended?: SystemRequirements } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get system information
        const sysInfo = await invoke<SystemInfo>("get_system_info");
        setSystemInfo(sysInfo);

        // Fetch Steam App ID for non-Steam games, then get requirements
        let appIdToUse = steamAppId;
        
        // If no Steam App ID and it's a non-Steam game, try to find it via Steam store search
        if (!appIdToUse && launcher && launcher !== "steam" && gameTitle) {
          try {
            const result = await invoke<{ appId?: string }>("get_steam_app_id_for_game", {
              gameId: gameId || null,
              gameName: gameTitle,
              launcher: launcher,
            });
            if (result.appId) {
              appIdToUse = result.appId;
            }
          } catch (searchError: any) {
            console.error("Failed to search Steam store:", searchError);
            // Continue without App ID
          }
        }

        // Fetch requirements if we have a Steam App ID
        if (appIdToUse) {
          try {
            const reqs = await invoke<{ minimum?: SystemRequirements; recommended?: SystemRequirements }>("get_steam_requirements", {
              appId: appIdToUse,
            });
            setRequirements(reqs);
          } catch (reqError: any) {
            console.error("Failed to fetch requirements:", reqError);
            setError("Could not fetch system requirements for this game.");
          }
        } else {
          setError("Steam App ID not available. System requirements cannot be fetched.");
        }
      } catch (err: any) {
        console.error("Failed to get system info:", err);
        setError("Failed to get system information.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId, steamAppId, gameTitle, launcher]);

  const parseMemoryGB = (memoryStr?: string): number | null => {
    if (!memoryStr) return null;
    const match = memoryStr.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (match) return parseFloat(match[1]);
    const matchMB = memoryStr.match(/(\d+)\s*MB/i);
    if (matchMB) return parseFloat(matchMB[1]) / 1024;
    return null;
  };

  const checkMemoryCompatibility = (reqMemory?: string): "compatible" | "warning" | "incompatible" => {
    if (!reqMemory || !systemInfo) return "warning";
    const reqGB = parseMemoryGB(reqMemory);
    if (reqGB === null) return "warning";
    if (systemInfo.ram_gb >= reqGB) return "compatible";
    if (systemInfo.ram_gb >= reqGB * 0.75) return "warning";
    return "incompatible";
  };

  const checkOSCompatibility = (reqOS?: string): "compatible" | "warning" | "incompatible" => {
    if (!reqOS || !systemInfo) return "warning";
    const reqLower = reqOS.toLowerCase();
    const sysOS = systemInfo.os.toLowerCase();
    
    if (reqLower.includes("windows")) {
      if (sysOS.includes("windows")) {
        // Check Windows version
        if (reqLower.includes("windows 11")) {
          return sysOS.includes("11") ? "compatible" : "warning";
        } else if (reqLower.includes("windows 10")) {
          return (sysOS.includes("10") || sysOS.includes("11")) ? "compatible" : "incompatible";
        }
        return "compatible";
      }
      return "incompatible";
    }
    return "warning";
  };

  const renderRequirement = (
    label: string,
    req?: string,
    compatibility?: "compatible" | "warning" | "incompatible"
  ) => {
    if (!req) return null;
    
    let iconElement = null;
    
    if (compatibility === "warning") {
      iconElement = <AlertCircle size={14} className="text-yellow-400 inline-block ml-1 align-middle" />;
    } else if (compatibility === "incompatible") {
      iconElement = <XCircle size={14} className="text-red-400 inline-block ml-1 align-middle" />;
    } else if (compatibility === "compatible") {
      iconElement = <CheckCircle size={14} className="text-green-400 inline-block ml-1 align-middle" />;
    }
    
    return (
      <li className="text-sm">
        <strong>{label}:</strong> <span className="text-foreground/80">{req}</span>
        {iconElement}
      </li>
    );
  };

  if (loading) {
    return <div className="text-foreground/60 flex flex-row gap-2 w-full h-fit justify-center items-center"><Loader2 size={16} className="animate-spin" /> Checking compatibility...</div>;
  }

  const minReqs = requirements?.minimum;
  const recReqs = requirements?.recommended;
  const osCompat = checkOSCompatibility(minReqs?.os);
  const memCompat = checkMemoryCompatibility(minReqs?.memory);

  return (
    <div className="flex flex-col gap-4 p-2">
      <h2 className="text-xl font-bold text-foreground/60 uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>System Compatibility</h2>
      
      {/* System Requirements Section */}
      {error && (
        <div className="bg-foreground/5 p-4 border border-foreground/10 text-foreground/60 text-sm">
          {error}
        </div>
      )}

      {/* Your System Info */}
      {systemInfo && (
        <div className="bg-foreground/5 p-4 border border-foreground/10">
          <h3 className="font-semibold mb-3">Your System</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div><strong>OS:</strong> {systemInfo.os} {systemInfo.os_version}</div>
            <div><strong>CPU:</strong> {systemInfo.cpu}</div>
            <div><strong>RAM:</strong> {systemInfo.ram_gb.toFixed(1)} GB</div>
            {systemInfo.gpu && (
              <div><strong>GPU:</strong> {systemInfo.gpu}{systemInfo.gpu_vram_gb ? ` (${systemInfo.gpu_vram_gb.toFixed(1)} GB VRAM)` : ""}</div>
            )}
          </div>
        </div>
      )}

      {/* Minimum Requirements */}
      {requirements && minReqs && (
        <div className="bg-foreground/5 p-4 border border-foreground/10">
          <h3 className="font-semibold mb-3">Minimum Requirements</h3>
          <ul className="space-y-2">
            {renderRequirement("OS", minReqs.os, osCompat)}
            {renderRequirement("Processor", minReqs.processor)}
            {renderRequirement("Memory", minReqs.memory, memCompat)}
            {renderRequirement("Graphics", minReqs.graphics)}
            {renderRequirement("Storage", minReqs.storage)}
            {minReqs.additional_notes && (
              <li className="text-xs text-foreground/60 mt-2 italic">{minReqs.additional_notes}</li>
            )}
          </ul>
        </div>
      )}

      {/* Recommended Requirements */}
      {requirements && recReqs && (
        <div className="bg-foreground/5 p-4 border border-foreground/10">
          <h3 className="font-semibold mb-3">Recommended Requirements</h3>
          <ul className="space-y-2">
            {renderRequirement("OS", recReqs.os)}
            {renderRequirement("Processor", recReqs.processor)}
            {renderRequirement("Memory", recReqs.memory)}
            {renderRequirement("Graphics", recReqs.graphics)}
            {renderRequirement("Storage", recReqs.storage)}
            {recReqs.additional_notes && (
              <li className="text-xs text-foreground/60 mt-2 italic">{recReqs.additional_notes}</li>
            )}
          </ul>
        </div>
      )}

      {/* Compatibility Summary */}
      {requirements && (minReqs || recReqs) && (
        <div className={`p-4 border ${
          memCompat === "incompatible" || osCompat === "incompatible"
            ? "bg-red-500/20 border-red-500/50"
            : memCompat === "warning" || osCompat === "warning"
            ? "bg-yellow-500/20 border-yellow-500/50"
            : "bg-green-500/20 border-green-500/50"
        }`}>
          <div className="flex items-center gap-2">
            {memCompat === "incompatible" || osCompat === "incompatible" ? (
              <>
                <XCircle size={20} className="text-red-400" />
                <span className="font-semibold">Your system may not meet minimum requirements</span>
              </>
            ) : memCompat === "warning" || osCompat === "warning" ? (
              <>
                <AlertCircle size={20} className="text-yellow-400" />
                <span className="font-semibold">Your system meets minimum requirements with warnings</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} className="text-green-400" />
                <span className="font-semibold">Your system appears to be compatible!</span>
              </>
            )}
          </div>
          <p className="text-sm text-white/80 mt-2">
            For accurate results, ensure you have the latest drivers and system updates.
          </p>
        </div>
      )}
      
      {!requirements && (
        <div className="text-white/60 text-center py-8">
          {error || "System requirements not available for this game."}
        </div>
      )}
    </div>
  );
};

