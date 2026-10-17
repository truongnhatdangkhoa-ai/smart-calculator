export type ErrorKind = 'syntax' | 'domain' | 'limit';

/** Lỗi tính toán có phân loại: cú pháp / miền xác định / vượt giới hạn. */
export class CalcError extends Error {
  kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = 'CalcError';
    this.kind = kind;
  }
}
