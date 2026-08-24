CREATE TABLE IF NOT EXISTS subject_stats_observation_meta (
  subject_id INTEGER PRIMARY KEY,
  first_observed_at INTEGER NOT NULL,
  recorded_count INTEGER NOT NULL,
  expired_count INTEGER NOT NULL,
  pruned_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
