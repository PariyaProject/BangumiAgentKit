CREATE TABLE IF NOT EXISTS subject_stats_observation_host_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  backoff_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
