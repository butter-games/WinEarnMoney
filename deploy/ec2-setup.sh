#!/bin/bash
# ============================================================
# EC2 Server Setup Script
# Run this ON the EC2 instance after SSH-ing in
#
# USAGE:
#   ssh -i your-key.pem ubuntu@your-ec2-ip
#   curl -O https://raw.githubusercontent.com/butter-games/WinEarnMoney/claude/winearnmoney-setup-g1srf/deploy/ec2-setup.sh
#   chmod +x ec2-setup.sh
#   ./ec2-setup.sh
# ============================================================

set -e

echo "============================================"
echo "  PlayRealMoneyGames - EC2 Server Setup"
echo "============================================"

# Step 1: System updates
echo "[1/6] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Step 2: Install Node.js 20
echo "[2/6] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Step 3: Install PostgreSQL
echo "[3/6] Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "  Creating database..."
sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'CHANGE_THIS_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE playrealmoneygames OWNER appuser;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE playrealmoneygames TO appuser;" 2>/dev/null || true

# Step 4: Install Nginx
echo "[4/6] Installing Nginx..."
sudo apt install -y nginx

# Configure Nginx as reverse proxy
sudo tee /etc/nginx/sites-available/playrealmoneygames > /dev/null <<'NGINX'
server {
    listen 80;
    server_name api.playrealmoneygames.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/playrealmoneygames /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Step 5: Install Certbot for SSL
echo "[5/6] Installing SSL (Let's Encrypt)..."
sudo apt install -y certbot python3-certbot-nginx
echo "  Run this after DNS is set up:"
echo "  sudo certbot --nginx -d api.playrealmoneygames.com"

# Step 6: Clone and setup app
echo "[6/6] Setting up application..."
cd /home/ubuntu
git clone https://github.com/butter-games/WinEarnMoney.git || true
cd WinEarnMoney/server
npm install

# Create .env file
cat > .env <<EOF
DATABASE_URL=postgresql://appuser:CHANGE_THIS_PASSWORD@localhost:5432/playrealmoneygames
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://playrealmoneygames.com
EOF

echo ""
echo "  ⚠️  IMPORTANT: Edit server/.env and change the database password!"
echo "  nano /home/ubuntu/WinEarnMoney/server/.env"
echo ""

# Run migrations
echo "  Running database migrations..."
node src/db/migrate.js

# Install PM2 for process management
echo "  Installing PM2..."
sudo npm install -g pm2
pm2 start src/index.js --name playrealmoneygames
pm2 startup
pm2 save

echo ""
echo "============================================"
echo "  SERVER SETUP COMPLETE!"
echo "============================================"
echo ""
echo "  API running at: http://localhost:3000"
echo "  Health check:   curl http://localhost:3000/api/health"
echo ""
echo "  Next steps:"
echo "  1. Edit server/.env - change database password"
echo "  2. Add DNS: api.playrealmoneygames.com → this EC2 IP"
echo "  3. Run: sudo certbot --nginx -d api.playrealmoneygames.com"
echo "  4. Update frontend API_URL to https://api.playrealmoneygames.com"
echo ""
