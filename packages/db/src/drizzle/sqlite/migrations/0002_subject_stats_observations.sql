CREATE TABLE IF NOT EXISTS subject_stats_observations (
  id TEXT PRIMARY KEY,
  subject_id INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  retrieved_at INTEGER,
  state TEXT NOT NULL,
  result_json TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  retention_until INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS subject_stats_observations_subject_observed_idx
  ON subject_stats_observations (subject_id, observed_at);

CREATE INDEX IF NOT EXISTS subject_stats_observations_retention_idx
  ON subject_stats_observations (retention_until);
