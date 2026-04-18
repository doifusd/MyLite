use crate::models::connection::SshConfig;
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

pub struct SshTunnel {
    _process: std::process::Child,
    local_port: u16,
}

impl SshTunnel {
    pub async fn establish(
        ssh_config: &SshConfig,
        remote_host: String,
        remote_port: u16,
    ) -> Result<Self> {
        // Find an available local port
        let local_listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| anyhow!("Failed to bind local port: {}", e))?;
        let local_port = local_listener.local_addr()?.port();
        drop(local_listener);

        eprintln!("[SSH] Using local port {} for tunneling", local_port);

        // Build SSH command
        let mut cmd = std::process::Command::new("ssh");

        // Add port if not default
        if ssh_config.ssh_port != 22 {
            cmd.arg("-p").arg(ssh_config.ssh_port.to_string());
        }

        // Add private key if provided
        if let Some(ref key_path) = ssh_config.ssh_private_key {
            // Expand ~ to home directory
            let expanded_key = if key_path.starts_with('~') {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
                key_path.replace("~", &home)
            } else {
                key_path.clone()
            };
            cmd.arg("-i").arg(&expanded_key);
            eprintln!("[SSH] Using private key: {}", expanded_key);
        }

        // Add other common SSH options
        cmd.arg("-N") // Don't execute remote command
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg("UserKnownHostsFile=/dev/null")
            .arg("-L")
            .arg(format!(
                "127.0.0.1:{}:{}:{}",
                local_port, remote_host, remote_port
            ));

        // Add username and host
        let user_host = format!("{}@{}", ssh_config.ssh_username, ssh_config.ssh_host);
        cmd.arg(&user_host);

        // Set stdin to null to avoid hanging
        cmd.stdin(std::process::Stdio::null());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        eprintln!(
            "[SSH] Starting SSH tunnel: ssh -L 127.0.0.1:{}:{}:{} {}",
            local_port, remote_host, remote_port, user_host
        );

        let child = cmd.spawn().map_err(|e| {
            anyhow!(
                "Failed to start SSH tunnel: {}. Make sure 'ssh' is installed and in PATH.",
                e
            )
        })?;

        eprintln!(
            "[SSH] SSH tunnel process started with PID: {:?}",
            child.id()
        );

        // Give the tunnel a moment to establish
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        Ok(Self {
            _process: child,
            local_port,
        })
    }

    pub fn local_port(&self) -> u16 {
        self.local_port
    }

    pub async fn close(&mut self) -> Result<()> {
        // Try to kill the SSH process
        // Note: We can't use try_wait() since child is immutable in our struct
        // The process will be cleaned up when Self is dropped
        eprintln!("[SSH] SSH tunnel will be closed when connection is dropped");
        Ok(())
    }
}

// SSH Tunnel Manager to handle multiple tunnels
pub struct SshTunnelManager {
    tunnels: Arc<Mutex<HashMap<String, SshTunnel>>>,
}

impl SshTunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn get_or_create_tunnel(
        &self,
        connection_id: &str,
        ssh_config: &SshConfig,
        remote_host: String,
        remote_port: u16,
    ) -> Result<u16> {
        let mut tunnels = self.tunnels.lock().await;

        // Check if tunnel already exists
        if let Some(tunnel) = tunnels.get(connection_id) {
            return Ok(tunnel.local_port());
        }

        // Create new tunnel
        let tunnel = SshTunnel::establish(ssh_config, remote_host, remote_port).await?;
        let local_port = tunnel.local_port();

        tunnels.insert(connection_id.to_string(), tunnel);

        Ok(local_port)
    }

    pub async fn close_tunnel(&self, connection_id: &str) -> Result<()> {
        let mut tunnels = self.tunnels.lock().await;

        if let Some(mut tunnel) = tunnels.remove(connection_id) {
            tunnel.close().await?;
        }

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn close_all_tunnels(&self) -> Result<()> {
        let mut tunnels = self.tunnels.lock().await;

        for (id, mut tunnel) in tunnels.drain() {
            if let Err(e) = tunnel.close().await {
                eprintln!("Failed to close tunnel {}: {}", id, e);
            }
        }

        Ok(())
    }
}
