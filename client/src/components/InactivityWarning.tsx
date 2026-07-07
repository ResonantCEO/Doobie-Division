import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface InactivityWarningProps {
  open: boolean;
  secondsLeft: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export default function InactivityWarning({
  open,
  secondsLeft,
  onStayLoggedIn,
  onLogoutNow,
}: InactivityWarningProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `${seconds}s`;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Still there?
          </DialogTitle>
          <DialogDescription className="text-base pt-1">
            You've been inactive for a while. For your security, you'll be automatically
            logged out in{" "}
            <span className="font-semibold text-foreground tabular-nums">{timeDisplay}</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onLogoutNow} className="sm:mr-2">
            Log out now
          </Button>
          <Button onClick={onStayLoggedIn}>
            Keep me logged in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
