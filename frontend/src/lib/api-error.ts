export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (error as { response?: { data?: { error?: unknown; detail?: unknown } } })?.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error && typeof data.error === 'object' && 'message' in data.error && typeof data.error.message === 'string') return data.error.message;
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
}
