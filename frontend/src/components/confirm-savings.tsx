'use client';

import { useState } from 'react';
import { useRecommendationsStore } from '@/lib/stores';
import { apiErrorMessage } from '@/lib/api-error';
import type { Recommendation } from '@/types/swm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function ConfirmSavings({ recommendation }: { recommendation: Recommendation }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { implementRecommendation } = useRecommendationsStore();
  const today = new Date().toLocaleDateString('en-CA');
  return <>
    <Button onClick={() => setOpen(true)}>Confirm actual savings</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirm actual savings</DialogTitle><DialogDescription>
          Record a saving that has already occurred. This amount is counted once on its effective date. Future recurring savings remain estimates. Confirmation does not change your vendor contract.
        </DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={async event => {
          event.preventDefault(); setSaving(true); setError('');
          try {
            await implementRecommendation(recommendation.id, { confirmed_savings: amount, savings_effective_date: date, savings_evidence: evidence });
            setOpen(false);
          } catch (err) { setError(apiErrorMessage(err, 'Could not confirm savings. Please retry.')); }
          finally { setSaving(false); }
        }}>
          <div className="space-y-2"><Label htmlFor={`saving-${recommendation.id}`}>Actual amount saved ({recommendation.currency})</Label><Input id={`saving-${recommendation.id}`} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`date-${recommendation.id}`}>Effective date</Label><Input id={`date-${recommendation.id}`} type="date" max={today} value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`evidence-${recommendation.id}`}>Evidence or reference</Label><Textarea id={`evidence-${recommendation.id}`} maxLength={5000} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="For example: credit note number, reduced invoice, or cancellation confirmation and amount." required /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Confirmed records cannot be overwritten. Check the amount and date before submitting.</p>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm savings'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
