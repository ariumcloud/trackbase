-- Auth belongs to several apps. Grant only the profile columns required by the
-- server-only admin RPCs, never password hashes, tokens or recovery secrets.
grant select (id,email,phone,created_at,last_sign_in_at,email_confirmed_at,raw_user_meta_data)
  on auth.users to service_role;
