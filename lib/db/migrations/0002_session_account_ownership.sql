-- Give each persisted session a relational owner so deleting an account
-- atomically revokes every browser and mobile session.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id integer;

-- Legacy sessions stored their account ID only inside JSON. Backfill valid
-- values first, then discard sessions that cannot be tied to an active user.
UPDATE sessions
SET user_id = (sess #>> '{user,id}')::integer
WHERE user_id IS NULL
  AND (sess #>> '{user,id}') ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = (sessions.sess #>> '{user,id}')::integer
  );

DELETE FROM sessions
WHERE user_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = sessions.user_id);

ALTER TABLE sessions
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%FOREIGN KEY (user_id)%'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_user_id" ON sessions (user_id);