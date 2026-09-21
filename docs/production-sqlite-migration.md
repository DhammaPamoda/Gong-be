# Production SQLite Migration Runbook

Use this runbook to migrate the existing JSON-backed production data to SQLite.
Do not perform the cleanup steps until the smoke test has passed and the backup
can be restored.

## 1. Maintenance window

1. Confirm there is no active course and notify the center of the maintenance window.
2. Stop the production server.
3. Confirm its process and port are stopped before copying data.

## 2. Preserve the pre-refactor state

1. Run `git status` and record the current branch and working-tree changes.
2. Create and switch to `backup/pre-data-infra-refactor-2026`.
3. Commit the current repository state on that branch.
4. Archive the production XDG Gong directory, including every legacy JSON file.
5. Preserve `assets/sounds/` with the archive.

Legacy migration inputs are:

- `assets/data/staticData.json`
- `assets/data/usersData.json`
- XDG `systemSettings.json` and `hk4KeyMap.json`
- XDG `coursesSchedule.json` and `archivedCoursesSchedule.json`
- XDG `manualGong.json` and `obsoleteManualGong.json`
- `assets/sounds/`

## 3. Run the migration

1. Check out the intended release branch/commit containing the SQLite migration script.
2. Restore the legacy JSON inputs from `backup/pre-data-infra-refactor-2026` or
   the XDG archive into the locations passed to the script.
3. Run the migration once for each required environment:

   ```sh
   NODE_ENV=development node scripts/migrate-json-to-sqlite.js
   NODE_ENV=production node scripts/migrate-json-to-sqlite.js
   ```

4. Keep the legacy JSON files and archive intact until verification completes.

## 4. Verify

1. Start the server using the migrated SQLite database.
2. Smoke test login, users, course templates, gong types, permissions, areas,
   HK4 settings, scheduled courses, and manual-gong scheduling.
3. Verify every `gong_types.pathName` has a corresponding file in `assets/sounds/`.
4. Run the E2E suite against the intended environment.
5. Create a SQLite snapshot with `backup_files.sh` and confirm restore can locate it.

## 5. Final cleanup

Only after verification:

1. Remove legacy JSON data files from the release repository and XDG directory.
2. Keep the archived pre-refactor branch and XDG archive as rollback material.
3. Use `gong-base.sqlite` and `npm run bootstrap-db` only for clean-environment setup,
   never to overwrite a populated production database.
