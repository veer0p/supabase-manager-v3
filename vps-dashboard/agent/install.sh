#!/bin/bash
set -e

INSTALL_DIR="/opt/vps-metrics"
SERVICE_NAME="vps-metrics"
PORT=9100

echo "=== VPS Metrics Agent Installer ==="

# Remove existing agent if present
echo "Cleaning up any existing agent..."
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f /etc/systemd/system/${SERVICE_NAME}.service
rm -rf "$INSTALL_DIR"
systemctl daemon-reload 2>/dev/null || true

# Fresh install
mkdir -p "$INSTALL_DIR"

# Copy agent script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/metrics_agent.py" "$INSTALL_DIR/metrics_agent.py"
chmod +x "$INSTALL_DIR/metrics_agent.py"

# Generate fresh token
TOKEN=$(openssl rand -hex 32)
echo "$TOKEN" > "$INSTALL_DIR/.token"
chmod 600 "$INSTALL_DIR/.token"
echo "Generated new auth token."

# Create systemd service
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=VPS Metrics Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/metrics_agent.py
Environment=METRICS_TOKEN=${TOKEN}
Environment=METRICS_PORT=${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# Open port in firewall
if command -v ufw &> /dev/null; then
    ufw allow ${PORT}/tcp 2>/dev/null || true
    echo "Opened port ${PORT} in UFW."
fi

echo ""
echo "=== Installation Complete ==="
echo "Agent running on port ${PORT}"
echo ""
echo "Your auth token:"
echo "  $TOKEN"
echo ""
echo "Save this token — you'll need it to connect your dashboard."
