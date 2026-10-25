-- Family Budget VN (Thu chi gia đình) — cấu trúc database (chạy 1 lần trong Supabase → SQL Editor)
-- Toàn bộ bảng bật RLS và KHÔNG có policy: chỉ máy chủ (dùng service_role key, nằm trên Vercel) đọc/ghi được.
-- Trình duyệt không bao giờ truy cập thẳng database.

create table if not exists members (
  id      bigint generated always as identity primary key,
  name    text not null unique,
  tg_id   text,                       -- Telegram User ID (nhắn /id cho bot để lấy)
  note    text,
  sort    int not null default 0
);

create table if not exists categories (
  id          bigint generated always as identity primary key,
  type        text not null,          -- Chi / Thu / Trả nợ / Vay / Cho vay / Thu hồi nợ
  name        text not null,
  grp         text,                   -- Thiết yếu / Linh hoạt / Theo năm...
  budget      bigint not null default 0,   -- Chi: ngân sách/tháng · Thu: thu nhập kế hoạch/tháng
  keywords    text not null default '',    -- từ khoá, cách nhau dấu phẩy
  budget_year bigint not null default 0,   -- >0: khoản theo năm (BHNT, du lịch)
  icon        text,
  sort        int not null default 0,
  unique (type, name)
);

create table if not exists budget_overrides (   -- ngân sách riêng cho 1 tháng (VD tháng Tết)
  month    text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null,
  budget   bigint not null,
  primary key (month, category)
);

create table if not exists debts (
  code           text primary key,     -- VD: NH-NHA, NGUOI-THAN...
  name           text not null,
  creditor       text,
  initial        bigint not null default 0,  -- dư nợ tại ngày bắt đầu theo dõi
  start_date     date,
  rate           numeric not null default 0, -- lãi suất %/năm hiện hành
  min_pay        bigint not null default 0,
  keywords       text not null default '',
  status         text not null default 'Đang trả',
  note           text,
  interest_cycle text not null default 'Tháng',  -- 'Tháng' | 'Năm' (trả lãi 1 lần/năm)
  next_due       date,                 -- hạn trả lãi năm tiếp theo
  next_amount    bigint,               -- số lãi kỳ tới (trống = dư nợ × lãi suất)
  sort           int not null default 0
);

create table if not exists assets (
  id       bigint generated always as identity primary key,
  name     text not null,
  type     text,                       -- Bất động sản / Vàng / Tiền mặt & tiết kiệm / Phải thu / Khác
  qty      numeric,
  unit     text,
  price    bigint,                     -- có qty + price thì giá trị = qty × price
  value    bigint,
  included boolean not null default true,  -- tính vào tài sản ròng?
  updated  date,
  note     text,
  sort     int not null default 0
);

create table if not exists transactions (
  id         text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  date       date not null,
  type       text not null check (type in ('Chi', 'Thu', 'Trả nợ', 'Vay', 'Cho vay', 'Thu hồi nợ')),
  category   text not null,
  amount     bigint not null check (amount > 0) constraint transactions_amount_max check (amount <= 1000000000000),
  person     text,
  debt       text references debts(code) on update cascade on delete set null,
  note       text not null default '' constraint transactions_note_len check (char_length(note) <= 500),
  source     text,                     -- Web / Telegram
  created_at timestamptz not null default now(),
  created_by text                      -- tg:<id> hoặc web
);
create index if not exists transactions_date_idx on transactions (date);
create index if not exists transactions_debt_idx on transactions (debt);

create table if not exists app_state (       -- trạng thái cảnh báo đã gửi...
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tg_updates (      -- chống xử lý trùng tin nhắn Telegram
  update_id bigint primary key,
  at        timestamptz not null default now()
);

alter table members          enable row level security;
alter table categories       enable row level security;
alter table budget_overrides enable row level security;
alter table debts            enable row level security;
alter table assets           enable row level security;
alter table transactions     enable row level security;
alter table app_state        enable row level security;
alter table tg_updates       enable row level security;

-- ===== Bảo mật (từ v1.1.0) =====
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
