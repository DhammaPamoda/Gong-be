# Running Gong Server with PM2

## Important: Root vs User Mode

PM2 can run in two separate modes:
- **User mode** (`pm2 ...`) - runs as your user, processes in `~/.pm2/`
- **Root mode** (`sudo pm2 ...`) - runs as root, processes in `/root/.pm2/`

These are **separate PM2 daemons** with separate process lists. Choose one and stick with it.

**If switching from root to user mode:**
```bash
sudo pm2 stop all
sudo pm2 delete all
sudo pm2 save
sudo pm2 kill
sudo systemctl disable pm2-root
sudo systemctl stop pm2-root
```

## Start the Server

```bash
pm2 start ~/projects/gong_dev_ops/dev_ops/ecosystem.config.js
```

## Make it Persist After Reboot

```bash
# 1. Generate startup script
pm2 startup

# 2. Run the command PM2 outputs (copy/paste it - looks like):
#    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u YOUR_USER --hp /home/YOUR_USER

# 3. Save process list
pm2 save
```

## Verify Persistence

```bash
# Check if startup service is enabled (replace YOUR_USER with your username)
systemctl status pm2-YOUR_USER

# Check saved processes
pm2 prettylist | grep name
```

## Common Commands

```bash
pm2 list              # Show running processes
pm2 logs gong_server  # View logs
pm2 restart gong_server
pm2 stop gong_server
```

