# Gong Data Model

This document describes application data that is created, changed, or retained by Gong. Configuration-only data is listed separately at the end.

## Persistence overview

| Storage | Purpose |
| --- | --- |
| `~/.local/share/gong/{dev-or-prod}/` | Dynamic schedules and generated history. The path is defined in [lib/config/dataPaths.js](../lib/config/dataPaths.js). |
| `~/.local/share/gong/{dev-or-prod}/gong.sqlite` | SQLite-backed runtime data, including manual gongs. |
| `assets/data/staticData.json` | User-managed course templates, gong catalog metadata, and permission assignments. Agenda records contain area IDs. |
| `~/.local/share/gong/{dev-or-prod}/systemSettings.json` | Legacy source for runtime settings. Area names are migrated into SQLite `areas`. |
| `assets/data/usersData.json` | User accounts and password hashes. |
| `assets/sounds/` | Uploaded gong audio files. |
| `logs/` and `~/.local/share/gong/logs/` | Operational and hardware diagnostics. |
| Browser IndexedDB/localStorage | Frontend cache, authentication token, and user preferences. |

The backend uses action-style `POST` routes for most mutations; CRUD labels below describe behavior, not HTTP verb names.

## 1. Course template

A reusable course definition used to generate scheduled gongs.

### Shape

Backend JSON records contain:

```text
course_name: string
days_count: number
 course_agenda: [{
   title?: string
   days: number[]
   gongs: {
     times: string[]       // HH:MM
     areas: number[]
     type: number          // gong type id
     volume?: number
     repeat?: number
   }
 }]
```

The runtime model is represented by [model/course.js](../model/course.js) and loaded into `utilsManager.coursesMap`.

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Supported; accepts an uploaded JSON array of templates. | `POST /api/data/course/uploadCourses`; [handlers/data/dataHandlers.js](../handlers/data/dataHandlers.js), [lib/persist/persistManager.js](../lib/persist/persistManager.js) |
| Read | Supported through all static data and an intended per-course endpoint. | `GET /api/data/staticData`; `GET /api/data/course/:id` |
| Update | No direct update. Re-uploading is rejected when the course name already exists. | Validation in [lib/persist/persistManager.js](../lib/persist/persistManager.js) |
| Delete | Supported by course name. | `POST /api/data/course/remove` |

The per-course handler reads `req.params.name` while the route declares `:id`; that detail endpoint should be treated as defective until corrected.

## 2. Scheduled course

An instance of a course template scheduled for a particular date.

### Shape

```text
id: number|string
a course_name: string
date: date/timestamp
startFromDay: number
exceptions?: ExceptionGong[]
testHoursRange?: object
```

`ExceptionGong` contains `day_number` and `time`; see [model/courseSchedule.js](../model/courseSchedule.js) and [model/exceptionGong.js](../model/exceptionGong.js).

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Supported. The scheduled course is expanded into automatic gong jobs. | `POST /api/data/coursesSchedule/add`; `gongsManager.addScheduledCourse` |
| Read | Supported as the active schedule list. | `GET /api/data/coursesSchedule` |
| Update | Partially supported. There is no general edit operation, but gong activation changes add/remove schedule exceptions. | `POST /api/data/gong/toggle` |
| Delete | Supported by scheduled-course id. | `POST /api/data/coursesSchedule/remove` |
| Archive | Automatic only. Completed instances are appended to `archivedCoursesSchedule.json`. | `lib/gongsManager.js` |

Active records are persisted in `coursesSchedule.json`. Completed records are retained in `archivedCoursesSchedule.json`.

## 3. Manual gong

A one-time gong scheduled directly by a user.

### Shape

```text
time: timestamp
gong: {
  gongType: number
  areas: number[]
  volume: number
  repeat: number
}
```

The runtime classes are [model/manualGong.js](../model/manualGong.js) and [model/gong.js](../model/gong.js).

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Supported for future gongs. | `POST /api/data/gong/add` |
| Read | Supported for active manual gongs. | `GET /api/data/gongs/list` |
| Update | No general record edit. | N/A |
| Delete | Supported; the record is deleted. | `POST /api/data/gong/remove` |
| Expire | Automatic when the scheduled time passes. | Record is deleted from SQLite. |

Manual gongs are stored in SQLite. `manual_gongs` holds the schedule, while
`manual_gong_areas` holds its target areas. Expired or removed records are deleted;
there is no retained manual-gong history.
The legacy JSON import preserves no array-position field; SQLite `id` is the record identity.

## 4. Gong type and audio asset

A selectable gong sound and its catalog metadata.

### Shape

```text
id: number
name: string
pathName: string       // filename under assets/sounds/
```

The model is [model/gongType.js](../model/gongType.js).

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Supported by uploading a new audio file. A new numeric id is assigned. | `POST /api/data/gong/upload` |
| Read | Supported as `staticData.gongTypes`. | `GET /api/data/staticData` |
| Update | Supported by uploading replacement audio with an existing `gongId`; metadata path is updated. | `POST /api/data/gong/upload` |
| Delete | Supported; removes metadata and the corresponding audio file. | `POST /api/data/gong/deleteFile` |

Metadata is stored in `assets/data/staticData.json`; binary audio is stored in `assets/sounds/`. The upload uses a temporary multipart file supplied by Formidable before copying it to the asset directory.

## 5. User account

An authenticated application user.

### Shape

```text
id: string
role: string              // user, super-user, admin, or dev
creation-date: timestamp
update-date: timestamp
encodedPasswd: string     // bcrypt hash; never a plaintext password
```

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Supported. Password is hashed before persistence. | `POST /api/data/user/add` |
| Read | Supported for authorized callers. | `GET /api/data/users/list` |
| Update role | Supported. | `POST /api/data/user/update` |
| Update password | Supported through password reset/update flow; password is re-hashed. | `POST /api/data/user/resetPassword` |
| Delete | Supported by user id. | `POST /api/data/user/remove` |

Records are stored in `assets/data/usersData.json` and reloaded into the in-memory user map after mutations. The separate `/users` routes are legacy/demo-style handlers and are not the main persistence API.

## 6. Permission assignment

The roles allowed to perform a named application action.

### Shape

```text
action: string
roles: string[]
order: number
```

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Not supported. Validation expects existing permission actions. | [lib/persist/persistManager.js](../lib/persist/persistManager.js) |
| Read | Supported as `staticData.permissions`. | `GET /api/data/staticData` |
| Update | Supported for the role list of existing actions. | `POST /api/data/permissions/update` |
| Delete | Not supported. | None |

Permission assignments are stored inside `assets/data/staticData.json`.

## 7. Area

A relay or physical target area to which a gong can be sent.

### Shape

```text
id: number
name: string
translation?: string
```

Area definitions are stored in `systemSettings.json` as an object whose keys are area IDs and whose values are names, for example `{ "0": "all" }`. Course agenda records in `staticData.json` and gong records reference those IDs. The frontend represents areas with [src/app/model/area.ts](../../Gong_fe/src/app/model/area.ts).

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Not supported by the application API. | None |
| Read | Supported through the server status response, which returns the settings area map. | Root status/next-gong response |
| Update | Not supported. | None |
| Delete | Not supported. | None |

Areas are effectively read-only hardware/domain metadata. Oref converts the configured area keys to numeric relay IDs when creating an emergency gong. The values are used as display labels; the current Oref routing logic uses the keys.

## 8. HK4 keypad settings

Configuration for four-key hardware sequences that trigger gongs.

### Shape

```text
enabled: boolean
sequences: {
  [sequence: string]: {
    gongType: number
    areas: number[]
    volume: number
    repeat: number
  }
}
```

The sequence key is the four-key input, such as `"1111"`. Each sequence references a `GongType` and one or more target `Area` IDs. Area `0` remains the legacy all-areas sentinel where used. The global enabled state is represented by `SystemSettings.hk4Enabled`, not by each sequence.

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | The file is initialized with defaults when missing. Individual sequences are created by saving the full map. | `dataPaths.initializeDataFiles`; `POST /api/hk4` |
| Read | Supported. | `GET /api/hk4` |
| Update | Supported by replacing the settings document or changing `enabled` through the status endpoint. | `POST /api/hk4`; `POST /api/hk4/status` |
| Delete | Individual sequences can be removed by saving a map without them. There is no dedicated delete endpoint. | Frontend HK4 configuration |

### Proposed SQLite structure

```text
hk4_key_sequences            // one row per key sequence
hk4_key_sequence_areas       // join table to areas
```

`Hk4KeySequence.gongTypeId` references `GongType`. Its area collection references `Area` through the join table. The migration reads the legacy JSON object and creates these rows.

## 9. System settings

Runtime and emergency-alert settings persisted by the backend.

### Shape

```text
runSecurityCheck: boolean
testing?: boolean
alertLocation: string
pollingInterval: number
overrideOrefUrl?: string
supportedAlertCategories: string[]
```

The legacy file may also contain an alert-routing map such as:

```json
{
  "areas": {
    "0": "all"
  }
}
```

Course agendas and gong records store area IDs as numeric references. The legacy alert module uses the special key `"0"` to mean all areas. The area map is not part of the SQLite `SystemSettings` entity.

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | The file is initialized with defaults when missing. | `dataPaths.initializeDataFiles` |
| Read | Supported. The backend loads the file at startup and returns the current settings. | `GET /api/systemSettings` |
| Update | Supported as a shallow merge of the submitted fields. The file is atomically rewritten and a `settingsUpdated` event is emitted. | `POST /api/systemSettings`; [lib/systemSettingsManager.js](../lib/systemSettingsManager.js) |
| Delete | Not supported. Individual fields or the whole file are not deleted through the API. | None |

### Runtime consumers

- `runSecurityCheck`, `pollingInterval`, `alertLocation`, and `overrideOrefUrl` control Oref polling and alert filtering.
- `supportedAlertCategories` filters alert categories before a gong is triggered.
- `testing` suppresses actual playback while retaining the alert-processing flow.
- The frontend reads and updates the settings through [system-settings.service.ts](../../Gong_fe/src/app/services/system-settings.service.ts).

The migrated `SystemSettings` row remains file-backed during the transitional SQLite phase. Alert-routing behavior, including the legacy `"0"` all-areas rule, remains owned by the alert module rather than this entity.

The migration currently creates that transitional structure as:

```text
system_settings
  id                    // singleton row, currently 1
  runSecurityCheck
  testing
  hk4Enabled
  alertLocation
  pollingInterval
  overrideOrefUrl
  supportedAlertCategories
```

## 10. Operational log record

Append-only diagnostic data generated by the server.

### Kinds

- General and error logs: `logs/combined.log`, `logs/error.log`
- Gong manager events: `logs/gongManager.log`
- Schedule manager events: `logs/scheduleManager.log`
- Relay/audio events: `logs/relayAndSoundManager.log`
- FTDI status lines: `~/.local/share/gong/logs/ftdi_status.log`

A log line may include timestamps, user actions, course/gong data, relay status, audio filenames, error details, or hardware diagnostics.

### CRUD

| Operation | Support |
| --- | --- |
| Create | Append/write by Winston or the relay logger. |
| Read | Filesystem or log-rotation tooling only; no application API. |
| Update | No record update; new entries are appended. |
| Delete | No application operation; rotation/administration may archive or remove files. |

## 11. Frontend cached data

This is a derived client-side copy, not an independent source of truth.

### IndexedDB

Database `gong-db` contains the object stores `COURSES`, `AREAS`, `GONGS`, and `PERMISSIONS`. The service is [src/app/shared/indexed-db.service.ts](../../Gong_fe/src/app/shared/indexed-db.service.ts).

| Operation | Support |
| --- | --- |
| Create/read/update | Static API responses are written with IndexedDB `put` and read on application startup. |
| Delete | All static stores are cleared when the backend `lastUpdatedTime` changes. |

### localStorage

The frontend stores:

- `access_token`: JWT used for authenticated requests.
- `static_update_time`: static-data cache version.
- `date_format`: user date-format preference.
- JSON-editor language ordering preference.

These values are written and read by the frontend services and middleware. Logout removes the token and static-data timestamp; Redux state itself is transient and disappears with the page.

## 12. Runtime-only entities

These entities exist while the server is running but do not have independent CRUD persistence:

- **Scheduled job**: `data`, `time`, `isManual`, `status`, and callback; represented by [model/job.js](../model/job.js).
- **Automatic gong job**: generated from a scheduled course and held in `automaticGongsMap`.
- **In-memory maps**: courses, gong types, users, schedules, and manual gongs reconstructed from files.
- **Emergency state**: current alert category/time and active state from Oref or test-emergency requests.
- **Relay/audio playback state**: current audio process and relay status.

These support operational commands but have no durable create/read/update/delete API. Emergency state can be read and cleared through `GET`/`DELETE /api/data/emergencyState`; triggering a test emergency is transient.

## Configuration excluded from the data model

These are application configuration rather than user/domain data:

- `hk4KeyMap.json`
- `config/default.json` and `config/production.json`
- i18n translation files
- deployment/build scripts

They do have read/update endpoints in places, but they are intentionally excluded from the entity CRUD model above.
