CREATE TABLE IF NOT EXISTS subject_stats_observation_host_meta (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  backoff_until TIMESTAMP NOT NULL DEFAULT TIMESTAMP 'epoch',
  updated_at TIMESTAMP NOT NULL
);
