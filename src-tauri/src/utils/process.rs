#[cfg(target_os = "windows")]
pub fn find_process_by_hint(hint: &str) -> bool {
    use sysinfo::{System};

    let mut system = System::new_all();
    system.refresh_processes();

    let hint = hint.to_lowercase();

    system.processes().values().any(|process| {
        process
            .name()
            .to_string()
            .to_lowercase()
            .contains(&hint)
    })
}

#[cfg(not(target_os = "windows"))]
pub fn find_process_by_hint(hint: &str) -> bool {
    use sysinfo::{System};

    let mut system = System::new_all();
    system.refresh_processes();

    let hint = hint.to_lowercase();

    system.processes().values().any(|process| {
        process
            .name()
            .to_lowercase()
            .contains(&hint)
    })
}
