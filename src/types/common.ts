export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

export type UnknownRecord = Record<string, unknown>;
export type Nullable<T> = T | null | undefined;

export type Paginated<T> = { items: T[]; nextCursor?: string | null };

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };
export type ApiResult<T> = ApiOk<T> | ApiErr;
