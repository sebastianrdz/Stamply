-- New card types. Separate migration: Postgres can't use a freshly added enum
-- value in the same transaction that adds it (0023 references 'checkin').
alter type program_type add value if not exists 'coupon';
alter type program_type add value if not exists 'membership';
alter type stamp_kind add value if not exists 'checkin';
