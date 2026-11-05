export function FormMessage({ message }: { message: string }) {
  return message ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{message}</div> : null;
}
