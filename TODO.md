# Gong System - Future Enhancements & TODOs

This file tracks requested features and improvements that couldn't be logged as GitHub issues.

## Upload Mechanism Enhancements
- [ ] **Gong Display Name**: Modify the `uploadGong` mechanism (frontend and backend) to allow users to specify a "Display Name" for the uploaded gong.
    - **Backend**: Update `uploadGong` handler to accept a name field and store it in `staticData.json`.
    - **Frontend**: Add an input field to the upload dialog for the gong name.
    - **UI**: Ensure the display name is used in the manual and automatic activation lists, falling back to the filename if the name is not provided.

## Maintenance
- [ ] **TypeScript Cleanup**: Address remaining Angular TypeScript compilation warnings in the frontend (`Gong_fe`) to improve build stability.
- [ ] **Formidable Migration**: Double-check all other upload handlers to ensure they are fully compatible with Formidable 3.x extra features (if needed).

## Bug Fixes
- [ ] **Course Removal Failure (Zombie Schedules)**: Fix `removeScheduledCourse` failing for courses that exist in `coursesSchedule.json` but aren't in memory (e.g., after the last gong of the day).
- [ ] **Limbo Course Logic**: Update `handleJsonCourseScheduleRecord` to properly archive courses that have finished all gongs but haven't reached their end date yet.
- [ ] **Startup Robustness**: Prevent server from failing to load all schedules if one schedule refers to a renamed or missing course template.
- [ ] **Areas filter TypeError**: Fix potential crash in `getStaticData` if `staticData.areas` is an object or missing.
