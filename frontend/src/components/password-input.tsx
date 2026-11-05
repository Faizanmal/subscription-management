'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input {...props} type={visible ? 'text' : 'password'} className={`pr-12 ${props.className || ''}`} /><Button type="button" variant="ghost" size="icon" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} disabled={props.disabled} className="absolute right-1 top-1 h-8 w-9" onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>;
}
