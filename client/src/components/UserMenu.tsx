/**
 * UserMenu — persistent top-right user dropdown shown on all org-facing pages.
 * Shows: name trigger, Back to Admin (admins only), Change Password dialog, Sign Out.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Shield, KeyRound, BookOpen, FolderOpen, Check } from "lucide-react";
import { toast } from "sonner";

const ORG_PAGES = new Set(["intake","implement","validation","workflows","specs","connectivity","tasks","library","complete","admin","users"]);

/** Build a sibling route path. Strips the current page segment (if known) and appends the new page. Works for both legacy (/org/:slug/page) and new-style (/org/:clientSlug/:orgSlug/page) URLs. */
function orgPath(pathname: string, page: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (ORG_PAGES.has(segments[segments.length - 1])) {
    segments.pop();
  }
  return "/" + segments.join("/") + "/" + page;
}

export interface UserMenuExtraItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

interface UserMenuProps {
  extraItems?: UserMenuExtraItem[];
}

export function UserMenu({ extraItems }: UserMenuProps = {}) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to change password");
    },
  });

  const handleSignOut = async () => {
    await logout();
    setLocation("/login");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 px-3">
            <span className="text-sm font-medium max-w-[140px] truncate">
              {user.name || user.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {extraItems && extraItems.length > 0 && (
            <>
              {extraItems.map((item) => (
                <DropdownMenuItem key={item.label} onClick={item.onClick}>
                  {item.icon}
                  {item.label}
                  {item.active && <Check className="w-4 h-4 ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {user.role === "admin" && (
            <>
              <DropdownMenuItem onClick={() => setLocation("/org/admin")}>
                <Shield className="w-4 h-4 mr-2" />
                Admin Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => {
            setLocation(orgPath(window.location.pathname, "specs"));
          }}>
            <BookOpen className="w-4 h-4 mr-2" />
            Specifications
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setLocation(orgPath(window.location.pathname, "library"));
          }}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Document Library
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <KeyRound className="w-4 h-4 mr-2" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePasswordOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
