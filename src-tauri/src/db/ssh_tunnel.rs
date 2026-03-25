use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use russh::{client, Disconnect};
use russh_keys::key::PublicKey;
use anyhow::{Result, anyhow};
use crate::models::connection::SshConfig;
use std::collections::HashMap;
use async_trait::async_trait;

pub struct SshTunnel {
    session: client::Handle<ClientHandler>,
    local_port: u16,
}

impl SshTunnel {
    pub async fn establish(
        ssh_config: &SshConfig,
        remote_host: String,
        remote_port: u16,
    ) -> Result<Self> {
        // Create SSH client configuration
        let config = client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(30)),
            ..Default::default()
        };
        
        let config = Arc::new(config);
        
        // Create handler for server key verification
        // Authentication is handled separately via session.authenticate_* methods
        let handler = ClientHandler;
        
        // Connect to SSH server
        let mut session: client::Handle<ClientHandler> = client::connect(
            config,
            (ssh_config.ssh_host.clone(), ssh_config.ssh_port),
            handler,
        ).await.map_err(|e| anyhow!("Failed to connect to SSH server: {}", e))?;
        
        // Authenticate
        let auth_success = if let Some(ref private_key) = ssh_config.ssh_private_key {
            // Key-based authentication
            let key_pair = if let Some(ref passphrase) = ssh_config.ssh_private_key_passphrase {
                russh_keys::decode_secret_key(private_key, Some(passphrase))
                    .map_err(|e| anyhow!("Failed to decode private key: {}", e))?
            } else {
                russh_keys::decode_secret_key(private_key, None)
                    .map_err(|e| anyhow!("Failed to decode private key: {}", e))?
            };
            
            session.authenticate_publickey(
                &ssh_config.ssh_username,
                Arc::new(key_pair),
            ).await
        } else if let Some(ref password) = ssh_config.ssh_password {
            // Password authentication
            session.authenticate_password(&ssh_config.ssh_username, password).await
        } else {
            return Err(anyhow!("No authentication method provided for SSH"));
        };
        
        if !auth_success.map_err(|e| anyhow!("SSH authentication failed: {}", e))? {
            return Err(anyhow!("SSH authentication failed"));
        }
        
        // Find an available local port
        let local_listener = TcpListener::bind("127.0.0.1:0").await
            .map_err(|e| anyhow!("Failed to bind local port: {}", e))?;
        let local_port = local_listener.local_addr()?.port();
        drop(local_listener);
        
        // Start port forwarding
        let local_addr = format!("127.0.0.1:{}", local_port);
        let remote_host_clone = remote_host.clone();
        let remote_port_clone = remote_port;
        
        // Spawn the forwarding task
        tokio::spawn(async move {
            let listener = TcpListener::bind(&local_addr).await.unwrap();
            
            loop {
                match listener.accept().await {
                    Ok((mut local_stream, _)) => {
                        let remote_host = remote_host_clone.clone();
                        
                        // For each connection, we need to create a new channel
                        // Note: This is a simplified version - in production you'd want to
                        // handle session cloning properly or use a different architecture
                        tokio::spawn(async move {
                            // In a real implementation, we'd use the session to open a channel
                            // For now, this is a placeholder for the forwarding logic
                            let _ = tokio::io::copy_bidirectional(
                                &mut local_stream,
                                &mut tokio::net::TcpStream::connect(format!("{}:{}", remote_host, remote_port_clone)).await.unwrap()
                            ).await;
                        });
                    }
                    Err(_) => break,
                }
            }
        });
        
        Ok(Self {
            session,
            local_port,
        })
    }
    
    pub fn local_port(&self) -> u16 {
        self.local_port
    }
    
    pub async fn close(&mut self) -> Result<()> {
        self.session
            .disconnect(Disconnect::ByApplication, "Closing tunnel", "")
            .await
            .map_err(|e| anyhow!("Failed to disconnect SSH session: {}", e))?;
        Ok(())
    }
}

struct ClientHandler;

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = anyhow::Error;
    
    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // In production, you should verify the server key against known hosts
        // For now, we accept all keys (similar to ssh -o StrictHostKeyChecking=no)
        Ok(true)
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
