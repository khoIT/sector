import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scanvault/ui';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { accountDisplayName } from './user-initials';

export type LogoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirm before signing out, as the legacy dashboard does.
 *
 * The confirmation earns its place on a shared machine, which is where this
 * app is used: a teaching room terminal signed in as one learner, where an
 * accidental click costs whoever is mid-upload their session.
 *
 * It names the account being signed out, because the reason people reach for
 * this menu at all is usually that they are not sure which account they are in.
 */
export function LogoutDialog({ open, onOpenChange }: LogoutDialogProps) {
  const auth = useAuth();
  const navigate = useNavigate();

  function confirm() {
    // signOut clears the stored session, the in-memory state and the React
    // Query cache, so nothing of this user's data survives into the next
    // session's first frame.
    auth.signOut();
    onOpenChange(false);
    navigate('/login', { replace: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign out?</DialogTitle>
          <DialogDescription>
            You are signed in as <span className="text-ink">{accountDisplayName(auth.user)}</span>.
            Anything still uploading will stop.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Stay signed in
          </Button>
          <Button variant="danger" size="sm" onClick={confirm}>
            Sign out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
