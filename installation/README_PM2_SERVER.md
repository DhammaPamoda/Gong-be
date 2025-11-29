# Running Gong Server with PM2

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
# Check if startup service is enabled
sudo systemctl status pm2-root

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

