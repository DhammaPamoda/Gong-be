# Gong Data Backups

This document describes the backup and restore behavior implemented by the scripts in `dev_ops/`.

## Backup locations

The scripts use these deployment paths on the target Linux host:

| Location | Purpose |
| --- | --- |
| `/home/<user>/projects/gong_backups/<timestamp>/` | Timestamped backup created by `backup_files.sh`. |
| `/home/<user>/projects/gong_backups/0_last_update/` | Rolling copy of the most recent backup, used by restore. |
| `/home/<user>/projects/gong_logs_archive/` | Rotated server logs managed by `logrotate`. |
| `/home/<user>/projects/gong_dev_ops/dev_ops_backups/<timestamp>/` | Timestamped snapshots of the dev-ops scripts themselves. |

The backup scripts use `/home/<user>/projects/gong_server/` as the deployed server directory and `/home/<user>/projects/gong_dev_ops/` as the deployed dev-ops directory.

## Application-data backup

[`backup_files.sh`](../dev_ops/backup_files.sh) creates two copies of the deployed `assets/` directory:

1. A historical copy under `/home/<user>/projects/gong_backups/<timestamp>/assets/`.
2. A rolling copy under `/home/<user>/projects/gong_backups/0_last_update/assets/`.

The script creates the timestamp using `YYYY_MM_DD_HH_MM_SS`. Before writing the rolling copy, it attempts to remove the previous contents of `0_last_update` and then copies the current assets directory into it.

### Included data

The copied `assets/` directory contains the file-backed data stored there, including:

- `assets/data/staticData.json`
  - Legacy `lastUpdatedTime` metadata only
- `assets/sounds/`
  - Uploaded gong audio files
- Other asset files present in the deployed directory

### Not included by `backup_files.sh`

The script does not copy the XDG runtime data directory. The following application data is therefore outside this backup path:

- `~/.local/share/gong/{dev-or-prod}/gong.sqlite` (including manual-gong data)
- `~/.local/share/gong/logs/ftdi_status.log`

This is a backup coverage gap: active schedules, SQLite-backed manual-gong history, system settings, and HK4 mappings are not protected by the repository's main backup script unless they are separately copied by an administrator.

## When backups run

[`server_stop.sh`](../dev_ops/server_stop.sh) runs the operational backup sequence when the server is stopped:

1. Stop the PM2 process, or the Docker PM2 runtime.
2. Wait for graceful termination and release port `3000`.
3. Run `logrotate` using [`gong_logrotate`](../dev_ops/gong_logrotate).
4. Run `backup_files.sh`.
5. Remove the deployed server directory contents as part of the refresh/stop workflow.

The backup happens after the service is stopped, so the copied asset files should not be changing during the copy. The script requires the deployment user and password and uses `sudo` for protected operations.

## Restore behavior

[`restore_files.sh`](../dev_ops/restore_files.sh) restores only the latest rolling asset backup:

```text
/home/<user>/projects/gong_backups/0_last_update/assets/
  -> /home/<user>/projects/gong_server/assets/
```

After copying the assets, it scans `dev_ops/patches/*.sh` in version order. A patch is run only when its marker is absent from `dev_ops/patches_installed/`; the script then creates that marker.

Restore recovers course templates, gong metadata, and audio files, but not the SQLite database.

## Log rotation

[`gong_logrotate`](../dev_ops/gong_logrotate) applies daily rotation to `/home/dhamma/projects/gong_server/logs/*.log` when the files are at least `100000` bytes:

- Keeps up to 200 rotated files.
- Adds a date suffix using `YYYY_MM_DD_HH_MM`.
- Uses `copytruncate`, so the running process can continue writing.
- Moves rotated files to `/home/dhamma/projects/gong_logs_archive/`.
- Creates rotated files with mode `0640` and owner/group `dhamma`.
- Adds the `-RESTART` extension.

Log rotation is archival housekeeping, not a backup of application domain data.

## Dev-ops script backups

[`refresh_dev_ops_actions.sh`](../dev_ops/refresh_dev_ops_actions.sh) protects the operational scripts before refreshing them:

1. Creates `/home/dhamma/projects/gong_dev_ops/dev_ops_backups/<timestamp>/`.
2. Copies the current files from `/home/dhamma/projects/gong_dev_ops/dev_ops/` into that snapshot.
3. Fetches the selected backend branch.
4. Replaces the deployed `dev_ops/` directory from the selected branch.
5. Copies the refreshed scripts back into `/home/dhamma/projects/gong_dev_ops/`.

This protects the previous dev-ops script set, not the application data files.

## Backup and restore matrix

| Data | Primary location | Included in `backup_files.sh` | Restored by `restore_files.sh` |
| --- | --- | --- | --- |
| Course templates | SQLite database in XDG data directory | No | No |
| Gong metadata | SQLite database in XDG data directory | No | No |
| Uploaded gong audio | `assets/sounds/` | Yes | Yes |
| User accounts | SQLite database in XDG data directory | No | No |
| Schedules | SQLite database in XDG data directory | No | No |
| Manual gongs | SQLite database in XDG data directory | No | No |
| System settings | SQLite database in XDG data directory | No | No |
| HK4 mappings | SQLite database in XDG data directory | No | No |
| Server logs | `Gong-be/logs/` | No | No |
| FTDI status log | XDG log directory | No | No |
| Dev-ops scripts | `gong_dev_ops/dev_ops/` | No | No; separately snapshotted by `refresh_dev_ops_actions.sh` |

## Operational limitations

- Backups are local filesystem copies; the scripts do not upload them to remote storage.
- The scripts do not encrypt backup directories.
- `backup_files.sh` accepts the sudo password as a script argument and passes it through shell here-strings; this exposes the secret to the process invocation and is a security concern.
- There is no retention policy for timestamped asset backups in the scripts.
- There is no integrity manifest or checksum verification after copying.
- Restore is not a complete application restore because it excludes XDG dynamic data and logs.
- The backup and restore scripts assume the hard-coded Linux deployment paths shown above; they do not use the backend's configurable `XDG_DATA_HOME` path.
