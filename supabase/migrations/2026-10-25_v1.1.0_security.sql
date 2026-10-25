-- Bản vá bảo mật v1.1.0 — chạy 1 lần trong Supabase → SQL Editor cho bản ĐANG CHẠY (cài từ v1.0).
-- Cài mới thì không cần: schema.sql đã gồm toàn bộ. Chạy lại nhiều lần cũng an toàn.

-- 1) Giới hạn đăng nhập theo IP, đếm nguyên tử trong Postgres (chống bắn request song song)
create table if not exists login_attempts (
  key          text primary key,                 -- 'ip:<sha256>' hoặc 'global'
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table login_attempts enable row level security;

-- Tăng bộ đếm và trả về số lần trong cửa sổ hiện tại (hết cửa sổ thì đếm lại từ 1). Một lệnh, không đọc-rồi-ghi.
create or replace function login_attempt(p_key text, p_window_seconds int)
returns int language sql security definer set search_path = public as $$
  insert into login_attempts as la (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when la.window_start < now() - make_interval(secs => p_window_seconds) then 1 else la.count + 1 end,
    window_start = case when la.window_start < now() - make_interval(secs => p_window_seconds) then now() else la.window_start end
  returning count;
$$;

create or replace function login_reset(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from login_attempts where key = p_key;
$$;

-- 2) Phiên bản phiên đăng nhập: tăng lên là mọi cookie cũ hết hiệu lực ("Đăng xuất mọi thiết bị")
create or replace function bump_session_version()
returns int language sql security definer set search_path = public as $$
  insert into app_state (key, value, updated_at) values ('session_version', '2'::jsonb, now())
  on conflict (key) do update set
    value = to_jsonb(coalesce((app_state.value #>> '{}')::int, 1) + 1),
    updated_at = now()
  returning (value #>> '{}')::int;
$$;

-- Chỉ máy chủ (service_role) được gọi các hàm trên
revoke all on function login_attempt(text, int) from public, anon, authenticated;
revoke all on function login_reset(text) from public, anon, authenticated;
revoke all on function bump_session_version() from public, anon, authenticated;
grant execute on function login_attempt(text, int) to service_role;
grant execute on function login_reset(text) to service_role;
grant execute on function bump_session_version() to service_role;

-- 3) Giới hạn dữ liệu giao dịch (áp cho dòng mới; dữ liệu cũ không bị kiểm lại)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_note_len') then
    alter table transactions add constraint transactions_note_len check (char_length(note) <= 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_amount_max') then
    alter table transactions add constraint transactions_amount_max check (amount <= 1000000000000) not valid;
  end if;
end $$;

-- 4) Dọn khoá cũ của bản v1.0 (bộ đếm chung toàn hệ thống, không còn dùng)
delete from app_state where key = 'login_fail';
