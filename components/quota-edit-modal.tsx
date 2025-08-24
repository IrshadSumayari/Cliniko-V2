'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface QuotaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    name: string;
    program: string;
    sessionsUsed: number;
    totalSessions: number;
    remainingSessions: number;
  };
  onSave: (data: { quota: number; sessionsUsed: number; reason: string }) => void;
}

export function QuotaEditModal({ isOpen, onClose, patient, onSave }: QuotaEditModalProps) {
  const { toast } = useToast();
  const [quota, setQuota] = useState(patient.totalSessions);
  const [sessionsUsed, setSessionsUsed] = useState(patient.sessionsUsed);
  const [reason, setReason] = useState('');

  const handleSave = () => {
    if (quota < sessionsUsed) {
      toast({
        title: 'Invalid Quota',
        description: 'Quota cannot be less than sessions used',
        variant: 'destructive',
      });
      return;
    }

    onSave({ quota, sessionsUsed, reason });
    onClose();
  };

  const handleClose = () => {
    setQuota(patient.totalSessions);
    setSessionsUsed(patient.sessionsUsed);
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Edit Quota for <span className="font-medium text-emerald-500">{patient.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="program" className="text-right">
              Program
            </Label>
            <div className="col-span-3">
              <span className="text-sm font-medium">{patient.program}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quota" className="text-right">
              Total Quota
            </Label>
            <Input
              id="quota"
              type="number"
              value={quota}
              onChange={(e) => setQuota(parseInt(e.target.value) || 0)}
              className="col-span-3"
              min={1}
            />
          </div>
          {/* <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sessionsUsed" className="text-right">
              Sessions Used
            </Label>
            <Input
              id="sessionsUsed"
              type="number"
              value={sessionsUsed}
              onChange={(e) => setSessionsUsed(parseInt(e.target.value) || 0)}
              className="col-span-3"
              min={0}
              max={quota}
            />
          </div> */}
          {/* <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="remaining" className="text-right">
              Remaining
            </Label>
            <div className="col-span-3">
              <span className="text-sm font-medium">{Math.max(0, quota - sessionsUsed)}</span>
            </div>
          </div> */}
          {/* <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason" className="text-right">
              Reason
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="col-span-3"
              placeholder="e.g., GP renewed referral, insurer approved more sessions"
            />
          </div> */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
