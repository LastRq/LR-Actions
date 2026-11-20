use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct ManagedServer(Mutex<Option<Child>>);

impl ManagedServer {
    fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                // Cerrar stdin pide al servidor un apagado ordenado (termina el informe en curso).
                drop(child.stdin.take());
                let deadline = std::time::Instant::now() + Duration::from_secs(20);
                while std::time::Instant::now() < deadline {
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                kill_process_tree(&mut child);
            }
        }
    }
}

fn kill_process_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirValidation {
    exists: bool,
    has_package_json: bool,
    has_cargo_toml: bool,
    valid: bool,
    message: String,
}

fn validate_project_dir_inner(path: &Path) -> DirValidation {
    if !path.exists() || !path.is_dir() {
        return DirValidation {
            exists: false,
            has_package_json: false,
            has_cargo_toml: false,
            valid: false,
            message: "La carpeta no existe.".to_string(),
        };
    }
    let has_package_json = path.join("package.json").is_file();
    let has_cargo_toml = path.join("Cargo.toml").is_file();
    let valid = has_package_json && has_cargo_toml;
    let message = match (has_package_json, has_cargo_toml) {
        (true, true) => "Proyecto válido (package.json y Cargo.toml detectados).".to_string(),
        (false, true) => "Falta package.json en esta carpeta.".to_string(),
        (true, false) => "Falta Cargo.toml en esta carpeta.".to_string(),
        (false, false) => "Faltan package.json y Cargo.toml en esta carpeta.".to_string(),
    };
    DirValidation {
        exists: true,
        has_package_json,
        has_cargo_toml,
        valid,
        message,
    }
}

fn extract_ready_url(line: &str) -> Option<String> {
    line.trim()
        .strip_prefix("READY_URL=")
        .filter(|u| {
            tauri::Url::parse(u).is_ok_and(|p| {
                p.scheme() == "http"
                    && p.host_str() == Some("127.0.0.1")
                    && p.port().is_some()
                    && p.username().is_empty()
                    && p.password().is_none()
            })
        })
        .map(|u| u.to_string())
}

fn locate_server_script(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    let manifest_parent = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    candidates.push(
        manifest_parent
            .join("scripts")
            .join("test-center")
            .join("server.mjs"),
    );
    if let Ok(res_dir) = app.path().resource_dir() {
        candidates.push(res_dir.join("scripts").join("test-center").join("server.mjs"));
        candidates.push(res_dir.join("server.mjs"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("scripts").join("test-center").join("server.mjs"));
        }
    }

    candidates
        .into_iter()
        .find(|p| p.is_file())
        .ok_or_else(|| "No se encontró scripts/test-center/server.mjs.".to_string())
}

#[tauri::command]
fn validate_project_dir(path: String) -> DirValidation {
    validate_project_dir_inner(Path::new(path.trim()))
}

#[tauri::command]
async fn pick_directory(app: AppHandle, initial_dir: Option<String>) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut builder = app
            .dialog()
            .file()
            .set_title("Selecciona el directorio del proyecto Identity Core");
        if let Some(dir) = initial_dir {
            let p = PathBuf::from(dir);
            if p.is_dir() {
                builder = builder.set_directory(p);
            }
        }
        builder
            .blocking_pick_folder()
            .and_then(|fp| fp.into_path().ok())
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
async fn launch_test_center(
    app: AppHandle,
    state: State<'_, ManagedServer>,
    project_dir: String,
) -> Result<(), String> {
    let project_path = PathBuf::from(project_dir.trim());
    let check = validate_project_dir_inner(&project_path);
    if !check.valid {
        return Err(check.message);
    }

    let script = locate_server_script(&app)?;
    state.stop();

    let mut cmd = Command::new("node");
    cmd.arg(&script)
        .arg("--no-browser")
        .arg("--exit-on-stdin-close")
        .arg("--project")
        .arg(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "No se encontró Node.js en PATH. Instala Node.js 22+ e intenta nuevamente.".to_string()
        } else {
            format!("No se pudo iniciar Node.js: {e}")
        }
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "No se pudo capturar la salida del servidor.".to_string())?;
    let stderr = child.stderr.take();

    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let tx_err = tx.clone();

    // Drena stdout en segundo plano para evitar bloqueo del pipe tras leer READY_URL.
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut notified = false;
        for line in reader.lines().map_while(Result::ok) {
            if !notified {
                if let Some(url) = extract_ready_url(&line) {
                    let _ = tx.send(Ok(url));
                    notified = true;
                }
            }
        }
        if !notified {
            let _ = tx.send(Err(
                "El servidor local se cerró antes de estar listo.".to_string()
            ));
        }
    });

    if let Some(err_stream) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(err_stream);
            let mut first_error = String::new();
            let mut clean_error = String::new();
            for line in reader.lines().map_while(Result::ok) {
                let trimmed = line.trim();
                if first_error.is_empty() && !trimmed.is_empty() {
                    first_error = trimmed.to_string();
                }
                if let Some(msg) = trimmed.strip_prefix("Error: ") {
                    clean_error = msg.trim().to_string();
                }
            }
            let reported = if !clean_error.is_empty() {
                clean_error
            } else {
                first_error
            };
            if !reported.is_empty() {
                let _ = tx_err.send(Err(reported));
            }
        });
    }

    let url_str = match rx.recv_timeout(Duration::from_secs(10)) {
        Ok(Ok(url)) => url,
        Ok(Err(msg)) => {
            kill_process_tree(&mut child);
            return Err(msg);
        }
        Err(_) => {
            kill_process_tree(&mut child);
            return Err("Tiempo agotado esperando al servidor local.".to_string());
        }
    };

    {
        let mut guard = state
            .0
            .lock()
            .map_err(|_| "Error interno de estado del servidor.".to_string())?;
        *guard = Some(child);
    }

    let parsed_url: tauri::Url = url_str
        .parse()
        .map_err(|e| format!("URL local inválida: {e}"))?;

    let folder_name = project_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| project_dir.clone());

    if let Some(existing) = app.get_webview_window("test-center") {
        let _ = existing.close();
    }

    WebviewWindowBuilder::new(&app, "test-center", WebviewUrl::External(parsed_url))
        .title(format!("LR-Actions — {folder_name}"))
        .inner_size(1260.0, 840.0)
        .min_inner_size(900.0, 620.0)
        .center()
        .build()
        .map_err(|e| {
            state.stop();
            format!("No se pudo abrir la ventana del Centro de Pruebas: {e}")
        })?;

    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.close();
    }

    Ok(())
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ManagedServer(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            validate_project_dir,
            pick_directory,
            launch_test_center
        ])
        .build(tauri::generate_context!())
        .expect("error building LR-Actions");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(server) = app_handle.try_state::<ManagedServer>() {
                server.stop();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn extract_ready_url_accepts_only_loopback() {
        assert_eq!(
            extract_ready_url("READY_URL=http://127.0.0.1:54321/abc/"),
            Some("http://127.0.0.1:54321/abc/".to_string())
        );
        assert_eq!(extract_ready_url("READY_URL=https://evil.example/"), None);
        assert_eq!(extract_ready_url("otra linea"), None);
        assert_eq!(extract_ready_url("READY_URL=http://127.0.0.1:1@evil.example/"), None);
        assert_eq!(extract_ready_url("READY_URL=http://127.0.0.1.evil.example:80/"), None);
    }

    #[test]
    fn validate_project_dir_checks_required_files() {
        let tmp = std::env::temp_dir().join(format!(
            "identity-core-tester-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let empty = validate_project_dir_inner(&tmp);
        assert!(!empty.valid);
        assert!(empty.exists);

        fs::write(tmp.join("package.json"), "{}").unwrap();
        let partial = validate_project_dir_inner(&tmp);
        assert!(!partial.valid);
        assert!(partial.has_package_json);
        assert!(!partial.has_cargo_toml);

        fs::write(tmp.join("Cargo.toml"), "[package]").unwrap();
        let valid = validate_project_dir_inner(&tmp);
        assert!(valid.valid);

        let _ = fs::remove_dir_all(&tmp);
    }
}
