import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SystemInfo {
  os: string;
  osVersion?: string;
  cpu: string;
  cpuCores: number;
  totalRAM: number | null;
  gpu?: string;
  gpuVRAM?: number;
  cpuUsage: number;
  memoryUsage: number | null;
  userAgent: string;
}

interface TauriSystemInfo {
  os: string;
  os_version?: string;
  cpu: string;
  ram_gb: number;
  gpu?: string;
  gpu_vram_gb?: number;
}

interface TauriSystemUsage {
  cpu_usage: number;
  memory_usage_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
}

interface SystemInfoDataPoint {
  time: string;
  cpu: number;
  memory: number | null;
}

export const useSystemInfo = (updateInterval: number = 2000) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [history, setHistory] = useState<SystemInfoDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastMeasureTimeRef = useRef<number>(performance.now());
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const staticInfoFetchedRef = useRef<boolean>(false);
  const fetchTimeoutRef = useRef<number | null>(null);
  const isPausedRef = useRef<boolean>(false);

  // Detect OS from user agent
  const detectOS = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Win")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Unknown";
  };

  // Fetch real CPU and memory usage from Tauri backend (with timeout)
  const fetchSystemUsage = async (): Promise<{ cpuUsage: number; memoryUsage: number | null; totalRAM?: number } | null> => {
    try {
      // Add timeout to prevent hanging (increased to 5 seconds for first call)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("System usage fetch timeout")), 5000);
      });
      
      const usage = await Promise.race([
        invoke<TauriSystemUsage>("get_system_usage"),
        timeoutPromise,
      ]);
      
      return {
        cpuUsage: usage.cpu_usage,
        memoryUsage: usage.memory_usage_percent,
        totalRAM: usage.memory_total_gb,
      };
    } catch (error) {
      // Only log if it's not a timeout (to reduce noise)
      if (!(error instanceof Error && error.message.includes("timeout"))) {
        console.error("Failed to fetch system usage:", error);
      }
      return null;
    }
  };

  // Get total RAM if available (Chrome only)
  const getTotalRAM = (): number | null => {
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory; // Returns GB
    }
    return null;
  };

  // Fetch static system info from Tauri backend (non-blocking)
  const fetchStaticSystemInfo = async () => {
    if (staticInfoFetchedRef.current) return;
    
    try {
      // Use requestIdleCallback to defer the call when browser is idle
      // This prevents blocking the UI
      const fetchWhenIdle = () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(
            async () => {
              try {
                // Add timeout to prevent hanging
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error("System info fetch timeout")), 10000);
                });
                
                const tauriInfo = await Promise.race([
                  invoke<TauriSystemInfo>("get_system_info"),
                  timeoutPromise,
                ]);
                
                setSystemInfo((prev) => {
                  const baseInfo: SystemInfo = {
                    os: tauriInfo.os || detectOS(),
                    osVersion: tauriInfo.os_version,
                    cpu: tauriInfo.cpu || "Unknown CPU",
                    cpuCores: navigator.hardwareConcurrency || 0,
                    totalRAM: tauriInfo.ram_gb || getTotalRAM(),
                    gpu: tauriInfo.gpu,
                    gpuVRAM: tauriInfo.gpu_vram_gb,
                    cpuUsage: prev?.cpuUsage || 0,
                    memoryUsage: prev?.memoryUsage || null,
                    userAgent: navigator.userAgent,
                  };
                  return baseInfo;
                });
                
                staticInfoFetchedRef.current = true;
                setIsLoading(false);
              } catch (error) {
                console.error("Failed to fetch system info:", error);
                // Fallback to browser-only info
                setSystemInfo((prev) => ({
                  ...prev!,
                  os: detectOS(),
                  cpu: "Unknown CPU",
                  cpuCores: navigator.hardwareConcurrency || 0,
                  totalRAM: getTotalRAM(),
                  cpuUsage: prev?.cpuUsage ?? 0,
                  memoryUsage: prev?.memoryUsage ?? null,
                  userAgent: navigator.userAgent,
                }));
                staticInfoFetchedRef.current = true;
                setIsLoading(false);
              }
            },
            { timeout: 5000 } // Don't wait more than 5 seconds
          );
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(async () => {
            try {
              // Add timeout to prevent hanging
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("System info fetch timeout")), 10000);
              });
              
              const tauriInfo = await Promise.race([
                invoke<TauriSystemInfo>("get_system_info"),
                timeoutPromise,
              ]);
              
              setSystemInfo((prev) => {
                const baseInfo: SystemInfo = {
                  os: tauriInfo.os || detectOS(),
                  osVersion: tauriInfo.os_version,
                  cpu: tauriInfo.cpu || "Unknown CPU",
                  cpuCores: navigator.hardwareConcurrency || 0,
                  totalRAM: tauriInfo.ram_gb || getTotalRAM(),
                  gpu: tauriInfo.gpu,
                  gpuVRAM: tauriInfo.gpu_vram_gb,
                  cpuUsage: prev?.cpuUsage || 0,
                  memoryUsage: prev?.memoryUsage ?? null,
                  userAgent: navigator.userAgent,
                };
                return baseInfo;
              });
              
              staticInfoFetchedRef.current = true;
              setIsLoading(false);
            } catch (error) {
              console.error("Failed to fetch system info:", error);
              setSystemInfo((prev) => ({
                ...prev!,
                os: detectOS(),
                cpu: "Unknown CPU",
                cpuCores: navigator.hardwareConcurrency || 0,
                totalRAM: getTotalRAM(),
                cpuUsage: prev?.cpuUsage ?? 0,
                memoryUsage: prev?.memoryUsage ?? null,
                userAgent: navigator.userAgent,
              }));
              staticInfoFetchedRef.current = true;
              setIsLoading(false);
            }
          }, 100); // Small delay to let UI render first
        }
      };

      fetchWhenIdle();
    } catch (error) {
      console.error("Error setting up system info fetch:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize with browser-only info first (instant)
    const initialInfo: SystemInfo = {
      os: detectOS(),
      cpu: "Loading...",
      cpuCores: navigator.hardwareConcurrency || 0,
      totalRAM: getTotalRAM(),
      cpuUsage: 0,
      memoryUsage: null,
      userAgent: navigator.userAgent,
    };
    setSystemInfo(initialInfo);
    lastFrameTimeRef.current = performance.now();
    lastMeasureTimeRef.current = performance.now();

    // Fetch static info from backend (non-blocking)
    fetchStaticSystemInfo();

    // Update CPU and memory usage periodically from host system (non-blocking)
    let isUpdating = false;
    let lastUpdateTime = 0;
    let timeoutId: number | null = null;
    
    const updateUsage = () => {
      // Don't update if paused (e.g., window hidden)
      if (isPausedRef.current) {
        return;
      }
      
      // Prevent overlapping calls
      if (isUpdating) {
        return;
      }
      
      // Throttle: don't update more frequently than updateInterval
      const now = Date.now();
      if (now - lastUpdateTime < updateInterval) {
        return;
      }
      lastUpdateTime = now;
      
      isUpdating = true;
      
      // Use setTimeout to defer the call and prevent blocking
      timeoutId = window.setTimeout(async () => {
        try {
          const usage = await fetchSystemUsage();
          
          if (usage) {
            const timestamp = new Date();

            // Update state (React will batch these)
            setSystemInfo((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                cpuUsage: usage.cpuUsage,
                memoryUsage: usage.memoryUsage,
                // Update total RAM from backend if available (more accurate)
                totalRAM: usage.totalRAM ?? prev.totalRAM,
              };
            });

            setHistory((prev) => {
              const newPoint: SystemInfoDataPoint = {
                time: timestamp.toLocaleTimeString(),
                cpu: usage.cpuUsage,
                memory: usage.memoryUsage,
              };
              const updated = [...prev, newPoint];
              return updated.slice(-60); // Keep last 60 points
            });
          }
          // If usage is null (timeout or error), keep previous values - don't crash
        } catch (error) {
          // Silently handle errors to prevent UI crashes
          // The previous values will remain displayed
        } finally {
          isUpdating = false;
        }
      }, 0); // Defer to next tick
    };
    
    // Start the update loop with a longer interval to reduce load
    const actualInterval = Math.max(updateInterval, 2000); // Minimum 2 seconds
    const interval = setInterval(updateUsage, actualInterval);
    
    // Pause updates when window is hidden to save resources
    const handleVisibilityChange = () => {
      isPausedRef.current = document.hidden;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial update after a delay to let UI render first
    timeoutId = window.setTimeout(updateUsage, 1000);

    return () => {
      clearInterval(interval);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateInterval]);

  return { systemInfo, history };
};

