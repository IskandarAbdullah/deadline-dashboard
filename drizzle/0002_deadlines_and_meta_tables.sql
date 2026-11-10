DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT NOT NULL UNIQUE,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_local TEXT NOT NULL,
  due_end_local TEXT,
  status TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT 'upcoming',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
