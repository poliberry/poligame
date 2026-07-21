fn main() {
    // Build Tauri
    tauri_build::build();
    
    // Tell Cargo to rerun this build script if environment variables change
    // This ensures the binary is rebuilt when API keys change
    println!("cargo:rerun-if-env-changed=STEAM_API_KEY");
    println!("cargo:rerun-if-env-changed=STEAMGRIDDB_API_KEY");
    
    // Note: API keys are embedded using option_env!() macro in src/api_keys.rs
    // They're read at compile time from environment variables set before building
    // No file writing needed - keys are directly embedded in the binary
}

