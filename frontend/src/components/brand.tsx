import Link from 'next/link';
import { productName } from '@/lib/public-content';

export function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} aria-label={`${productName} home`} className="inline-flex min-w-0 items-center gap-2 font-semibold tracking-tight">
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">S</span>
    <span className="hidden max-w-52 text-sm leading-tight sm:block">Subscription<br />Waste Manager</span>
    <span className="sm:hidden">SWM</span>
  </Link>;
}
