/**
 * Lỗi được phép hiện nguyên văn cho người dùng (sai mật khẩu, dữ liệu nhập sai...).
 * Mọi lỗi khác (database, thiếu cấu hình, bug) chỉ ghi log máy chủ, client nhận thông báo chung.
 */
export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UserError';
    this.status = status;
  }
}

/** Thiếu / sai biến môi trường. Không lộ tên biến ra ngoài, chỉ ghi log. */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Chuyển lỗi bất kỳ thành {status, body} an toàn để trả về client */
export function publicError(err) {
  if (err instanceof UserError) return { status: err.status, body: { error: err.message } };
  console.error(err && err.stack || err);
  if (err instanceof ConfigError) {
    return { status: 500, body: { error: 'Máy chủ chưa cấu hình đủ. Chủ app xem chi tiết trong log Vercel (Project → Logs).' } };
  }
  return { status: 500, body: { error: 'Lỗi máy chủ, thử lại sau. Chủ app xem chi tiết trong log Vercel (Project → Logs).' } };
}
