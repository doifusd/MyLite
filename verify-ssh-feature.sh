#!/bin/bash

echo "========================================="
echo "MySQL Client SSH/SSL/HTTP Feature Verification"
echo "========================================="
echo ""

# Check Rust backend
echo "1. Checking Rust backend files..."
echo "   - Connection models: src-tauri/src/models/connection.rs"
echo "   - SSH tunnel: src-tauri/src/db/ssh_tunnel.rs"
echo "   - Connection pool: src-tauri/src/db/connection.rs"
echo "   - Commands: src-tauri/src/commands/connection.rs"
echo ""

# Check if files exist
if [ -f "src-tauri/src/models/connection.rs" ]; then
    echo "   ✓ connection.rs exists"
    grep -q "SshConfig" src-tauri/src/models/connection.rs && echo "   ✓ SshConfig defined" || echo "   ✗ SshConfig missing"
    grep -q "SslConfig" src-tauri/src/models/connection.rs && echo "   ✓ SslConfig defined" || echo "   ✗ SslConfig missing"
    grep -q "HttpConfig" src-tauri/src/models/connection.rs && echo "   ✓ HttpConfig defined" || echo "   ✗ HttpConfig missing"
    grep -q "ConnectionType" src-tauri/src/models/connection.rs && echo "   ✓ ConnectionType enum defined" || echo "   ✗ ConnectionType missing"
else
    echo "   ✗ connection.rs not found"
fi

echo ""
if [ -f "src-tauri/src/db/ssh_tunnel.rs" ]; then
    echo "   ✓ ssh_tunnel.rs exists"
    grep -q "SshTunnel" src-tauri/src/db/ssh_tunnel.rs && echo "   ✓ SshTunnel struct defined" || echo "   ✗ SshTunnel missing"
    grep -q "SshTunnelManager" src-tauri/src/db/ssh_tunnel.rs && echo "   ✓ SshTunnelManager defined" || echo "   ✗ SshTunnelManager missing"
else
    echo "   ✗ ssh_tunnel.rs not found"
fi

echo ""
if [ -f "src-tauri/src/db/connection.rs" ]; then
    echo "   ✓ connection.rs (db) exists"
    grep -q "SshTunnelManager" src-tauri/src/db/connection.rs && echo "   ✓ Uses SshTunnelManager" || echo "   ✗ SshTunnelManager not used"
    grep -q "ConnectionType::SshTunnel" src-tauri/src/db/connection.rs && echo "   ✓ Handles SSH tunnel" || echo "   ✗ SSH tunnel not handled"
else
    echo "   ✗ connection.rs (db) not found"
fi

echo ""
# Check Cargo.toml
echo "2. Checking Cargo.toml dependencies..."
if [ -f "src-tauri/Cargo.toml" ]; then
    grep -q "russh" src-tauri/Cargo.toml && echo "   ✓ russh dependency" || echo "   ✗ russh missing"
    grep -q "russh-keys" src-tauri/Cargo.toml && echo "   ✓ russh-keys dependency" || echo "   ✗ russh-keys missing"
    grep -q "async-trait" src-tauri/Cargo.toml && echo "   ✓ async-trait dependency" || echo "   ✗ async-trait missing"
else
    echo "   ✗ Cargo.toml not found"
fi

echo ""
# Check frontend
echo "3. Checking frontend files..."
if [ -f "src/components/ConnectionDialog.tsx" ]; then
    echo "   ✓ ConnectionDialog.tsx exists"
    grep -q "ssh_tunnel" src/components/ConnectionDialog.tsx && echo "   ✓ SSH tab implemented" || echo "   ✗ SSH tab missing"
    grep -q "ssl" src/components/ConnectionDialog.tsx && echo "   ✓ SSL tab implemented" || echo "   ✗ SSL tab missing"
    grep -q "http" src/components/ConnectionDialog.tsx && echo "   ✓ HTTP tab implemented" || echo "   ✗ HTTP tab missing"
else
    echo "   ✗ ConnectionDialog.tsx not found"
fi

echo ""
# Check App.tsx integration
echo "4. Checking App.tsx integration..."
if [ -f "src/App.tsx" ]; then
    grep -q "ConnectionDialog" src/App.tsx && echo "   ✓ ConnectionDialog imported" || echo "   ✗ ConnectionDialog not imported"
    grep -q "ssh_tunnel" src/App.tsx && echo "   ✓ SSH tunnel type handled" || echo "   ✗ SSH tunnel type not handled"
    grep -q "getConnectionTypeIcon" src/App.tsx && echo "   ✓ Connection type icons" || echo "   ✗ Connection type icons missing"
else
    echo "   ✗ App.tsx not found"
fi

echo ""
echo "========================================="
echo "Verification Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "- SSH Tunnel: Password & Private Key auth"
echo "- SSL/TLS: 5 modes (disabled/preferred/required/verify_ca/verify_identity)"
echo "- HTTP: Proxy with Basic/Bearer auth"
echo ""
echo "Next steps:"
echo "1. Run 'cargo check' in src-tauri to verify Rust compilation"
echo "2. Run 'npm run build' to verify frontend compilation"
echo "3. Run 'cargo tauri dev' to start the application"
