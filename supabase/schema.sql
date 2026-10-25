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
  amount     bigint not null check (amount > 0),
  person     text,
  debt       text references debts(code) on update cascade on delete set null,
  note       text not null default '',
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
