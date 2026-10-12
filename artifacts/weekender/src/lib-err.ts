export function errMsg(err: unknown, fallback: string): string {
  const e = err as { data?: { error?: string }; message?: string } | undefined;
  return e?.data?.error || e?.message || fallback;
}
