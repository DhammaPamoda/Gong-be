# Gong Data Backups

## What is backed up

Gong's mutable application data is stored in SQLite. When the server is stopped,
[`backup_files.sh`](../dev_ops/backup_files.sh) creates:

- a timestamped `snapshot-gong.sqlite`;
- a rolling `0_last_update/snapshot-gong.sqlite` used by restore;
- timestamped and rolling copies of `assets/sounds/`, because uploaded gong audio is mutable.

The target production data directory is `${XDG_DATA_HOME:-/home/<user>/.local/share}/gong/prod`.
Backups are stored under `/home/<user>/projects/gong_backups/`.

## Restore

[`restore_files.sh`](../dev_ops/restore_files.sh) restores the rolling SQLite
snapshot to the production XDG data directory and restores the rolling sounds
directory into the deployed server assets. Run it only while the server is stopped.

## Coverage

| Data | Backup source | Restored by `restore_files.sh` |
| --- | --- | --- |
| Users, permissions, course templates/agendas, schedules, manual gongs, areas, HK4, system settings | `gong.sqlite` | Yes |
| Uploaded gong audio | `assets/sounds/` | Yes |
| Logs | Log rotation/archive flow | No |
| i18n and application configuration | Git/deployment artifact | No |

Backups remain local filesystem copies. They are not encrypted, uploaded remotely,
or protected by a retention policy.
