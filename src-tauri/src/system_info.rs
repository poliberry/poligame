use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub cpu: String,
    pub ram_gb: f64,
    pub gpu: Option<String>,
    pub gpu_vram_gb: Option<f64>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Get OS info
        let os = "Windows".to_string();
        let os_version = std::env::var("OS").unwrap_or_else(|_| "Unknown".to_string());
        
        // Get CPU info using wmic
        let cpu_output = Command::new("wmic")
            .args(["cpu", "get", "name", "/format:list"])
            .output()
            .map_err(|e| format!("Failed to get CPU info: {}", e))?;
        
        let cpu = String::from_utf8_lossy(&cpu_output.stdout)
            .lines()
            .find(|line| line.starts_with("Name="))
            .map(|line| line.trim_start_matches("Name=").trim().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());
        
        // Get RAM info
        let ram_output = Command::new("wmic")
            .args(["computersystem", "get", "TotalPhysicalMemory", "/format:list"])
            .output()
            .map_err(|e| format!("Failed to get RAM info: {}", e))?;
        
        let ram_bytes: u64 = String::from_utf8_lossy(&ram_output.stdout)
            .lines()
            .find(|line| line.starts_with("TotalPhysicalMemory="))
            .and_then(|line| line.trim_start_matches("TotalPhysicalMemory=").trim().parse().ok())
            .unwrap_or(0);
        
        let ram_gb = (ram_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        
        // Get GPU info
        let gpu_output = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name", "/format:list"])
            .output()
            .map_err(|e| format!("Failed to get GPU info: {}", e))?;
        
        let gpu = String::from_utf8_lossy(&gpu_output.stdout)
            .lines()
            .find(|line| line.starts_with("Name="))
            .map(|line| line.trim_start_matches("Name=").trim().to_string());
        
        // Get GPU VRAM
        let gpu_vram_output = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "AdapterRAM", "/format:list"])
            .output()
            .ok();
        
        let gpu_vram_gb = gpu_vram_output
            .and_then(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .find(|line| line.starts_with("AdapterRAM="))
                    .and_then(|line| {
                        line.trim_start_matches("AdapterRAM=")
                            .trim()
                            .parse::<u64>()
                            .ok()
                            .map(|bytes| (bytes as f64) / (1024.0 * 1024.0 * 1024.0))
                    })
            });
        
        Ok(SystemInfo {
            os,
            os_version,
            cpu,
            ram_gb,
            gpu,
            gpu_vram_gb,
        })
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Fallback for non-Windows systems
        Ok(SystemInfo {
            os: "Unknown".to_string(),
            os_version: "Unknown".to_string(),
            cpu: "Unknown CPU".to_string(),
            ram_gb: 0.0,
            gpu: None,
            gpu_vram_gb: None,
        })
    }
}

