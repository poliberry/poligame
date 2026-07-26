use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub cpu: String,
    pub ram_gb: f64,
    pub gpu: Option<String>,
    pub gpu_vram_gb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageDriveInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkOverview {
    pub online: bool,
    pub label: String,
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

#[tauri::command]
pub fn list_storage_drives() -> Result<Vec<StorageDriveInfo>, String> {
    let disks = sysinfo::Disks::new_with_refreshed_list();

    let mut drives = Vec::new();
    for disk in disks.list() {
        let name = disk.name().to_string_lossy().to_string();
        let mount_point = disk.mount_point().to_string_lossy().to_string();
        let file_system = disk.file_system().to_string_lossy().to_string();
        let total_bytes = disk.total_space();
        let available_bytes = disk.available_space();

        drives.push(StorageDriveInfo {
            name,
            mount_point,
            file_system,
            total_bytes,
            available_bytes,
        });
    }

    Ok(drives)
}

#[tauri::command]
pub async fn get_network_overview() -> Result<NetworkOverview, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to build network checker: {}", e))?;

    let online = client
        .head("https://www.msftconnecttest.com/connecttest.txt")
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false);

    let label = if online {
        "Connected".to_string()
    } else {
        "Offline or restricted".to_string()
    };

    Ok(NetworkOverview { online, label })
}

#[tauri::command]
pub fn open_network_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:network-status"])
            .spawn()
            .map_err(|e| format!("Failed to open Windows network settings: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.NetworkSettings")
            .spawn()
            .map_err(|e| format!("Failed to open macOS network settings: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg("settings://network")
            .spawn()
            .map_err(|e| format!("Failed to open Linux network settings: {}", e))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported OS for opening network settings".to_string())
}

