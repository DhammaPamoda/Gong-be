# Gong Data Model

This document describes application data that is created, changed, or retained by Gong. Configuration-only data is listed separately at the end.

## Persistence overview

| Storage | Purpose |
| --- | --- |
| `~/.local/share/gong/{dev-or-prod}/` | Dynamic schedules, manual gongs, and generated history. The path is defined in [lib/config/dataPaths.js](../lib/config/dataPaths.js). |
| `assets/data/staticData.json` | User-managed course templates, gong catalog metadata, areas, and permission assignments. |
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
isActive: boolean
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
| Update | No general record edit. Active state is changed through the toggle operation. | `POST /api/data/gong/toggle` |
| Delete | Supported; removal moves the record to obsolete history where applicable. | `POST /api/data/gong/remove` |
| Expire/archive | Automatic when the scheduled time passes. | `manualGong.json` -> `obsoleteManualGong.json` |

Active records are stored in `manualGong.json`. Expired/removed records are stored in `obsoleteManualGong.json` with `del_code: "O"`. There is no API to list, edit, or purge obsolete records.

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

Areas are defined in static data and represented in the frontend by [src/app/model/area.ts](../../Gong_fe/src/app/model/area.ts).

### Storage and CRUD

| Operation | Support | Implementation |
| --- | --- | --- |
| Create | Not supported by the application API. | None |
| Read | Supported through static data; the backend limits the returned list by `NO_OF_PORTS`. | `GET /api/data/staticData` |
| Update | Not supported. | None |
| Delete | Not supported. | None |

Areas are effectively read-only hardware/domain metadata. They are referenced by scheduled and manual gong records.

## 8. Operational log record

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

## 9. Frontend cached data

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

## 10. Runtime-only entities

These entities exist while the server is running but do not have independent CRUD persistence:

- **Scheduled job**: `data`, `time`, `isManual`, `status`, and callback; represented by [model/job.js](../model/job.js).
- **Automatic gong job**: generated from a scheduled course and held in `automaticGongsMap`.
- **In-memory maps**: courses, gong types, users, schedules, and manual gongs reconstructed from files.
- **Emergency state**: current alert category/time and active state from Oref or test-emergency requests.
- **Relay/audio playback state**: current audio process and relay status.

These support operational commands but have no durable create/read/update/delete API. Emergency state can be read and cleared through `GET`/`DELETE /api/data/emergencyState`; triggering a test emergency is transient.

## Configuration excluded from the data model

These are application configuration rather than user/domain data:

- `systemSettings.json`
- `hk4KeyMap.json`
- `config/default.json` and `config/production.json`
- i18n translation files
- deployment/build scripts

They do have read/update endpoints in places, but they are intentionally excluded from the entity CRUD model above.
