'use client';

import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function PolicyCheckbox({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-start gap-3"><Checkbox id="accept-policies" checked={checked} onCheckedChange={value => onChange(value === true)} disabled={disabled} required className="mt-1" /><Label htmlFor="accept-policies" className="text-sm font-normal leading-6">I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Privacy Policy</Link>.</Label></div>;
}
