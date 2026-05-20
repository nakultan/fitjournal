/**
 * FitJournal data layer.
 *
 * The full on-device storage module and data types are built in Phase 2
 * (Roadmap Epic 2.1). This file marks the folder's purpose and holds the
 * schema version, which the migration logic will rely on.
 */

/** Bumped whenever the saved-data shape changes, so migrations stay safe. */
export const SCHEMA_VERSION = 1
