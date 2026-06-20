export function ok<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    message: message ?? null,
  };
}

export function fail(error: string, message: string) {
  return {
    success: false as const,
    data: null,
    error,
    message,
  };
}
