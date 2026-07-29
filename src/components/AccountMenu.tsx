import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, BarChart3, ChevronDown, LogOut, Settings2, Trash2, UserCircle, type LucideIcon } from 'lucide-react';
import type { CentralAuthUser } from '../lib/centralAuth';

export function AccountMenu({
  user,
  onOpenHabits,
  onOpenSettings,
  onOpenInsights,
  onLogout,
  onLogoutAndRemoveData,
  compactOnMobile = false,
}: {
  user: CentralAuthUser | null;
  onOpenHabits?: () => void;
  onOpenSettings: () => void;
  onOpenInsights: () => void;
  onLogout: () => void;
  onLogoutAndRemoveData?: () => void;
  compactOnMobile?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = user?.name || user?.email?.split('@')[0] || 'Account';

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setIsOpen(true);
          window.setTimeout(() => menuItems()[0]?.focus(), 0);
        }}
        className={`flex min-h-11 items-center gap-2 border-2 text-left transition ${
          compactOnMobile
            ? 'w-11 max-w-11 justify-center px-2 min-[480px]:w-auto min-[480px]:max-w-[12.5rem] min-[480px]:justify-start min-[480px]:px-3 md:max-w-[16rem]'
            : 'max-w-[12.5rem] px-2.5 sm:max-w-[16rem] sm:px-3'
        } ${
          isOpen
            ? 'border-accent-green/60 bg-accent-green/10 text-white'
            : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/30 hover:bg-white/[0.07] hover:text-white'
        } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px`}
        aria-label={`Open account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="account-menu"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-black/40">
          {user?.avatarUrl && user.avatarUrl !== failedAvatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedAvatarUrl(user.avatarUrl ?? null)} />
          ) : (
            <UserCircle className="h-4 w-4" strokeWidth={2.5} />
          )}
        </span>
        <span className={`min-w-0 flex-1 ${compactOnMobile ? 'hidden min-[480px]:block' : ''}`}>
          <span className="block truncate text-xs font-black text-white">{name}</span>
          <span className="hidden truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 sm:block">Account</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${compactOnMobile ? 'hidden min-[480px]:block' : ''} ${isOpen ? 'rotate-180' : ''}`} strokeWidth={3} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="account-menu"
            ref={menuRef}
            role="menu"
            aria-label="Profile and navigation"
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(18rem,calc(100vw-2rem))] border-2 border-white/20 bg-[#0b0b0b] p-2 shadow-[8px_8px_0_rgba(0,0,0,0.85)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          >
            <div className="border-b border-white/10 px-3 py-3">
              <div className="truncate text-sm font-black text-white">{name}</div>
              <div className="mt-1 truncate text-xs text-white/40">{user?.email || 'Signed in'}</div>
            </div>
            <div className="py-2">
              {onOpenHabits && <AccountMenuItem icon={Activity} label="Habit Intelligence" onClick={() => runAction(onOpenHabits)} />}
              <AccountMenuItem icon={Settings2} label="Settings" onClick={() => runAction(onOpenSettings)} />
              <AccountMenuItem icon={BarChart3} label="Focus insights" onClick={() => runAction(onOpenInsights)} />
            </div>
            <div className="border-t border-white/10 pt-2">
              <AccountMenuItem icon={LogOut} label="Sign out" onClick={() => runAction(onLogout)} danger />
              {onLogoutAndRemoveData && (
                <AccountMenuItem
                  icon={Trash2}
                  label="Sign out & remove desktop data"
                  onClick={() => runAction(onLogoutAndRemoveData)}
                  danger
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenuItem({ icon: Icon, label, onClick, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset active:translate-y-px ${
        danger
          ? 'text-red-300 hover:bg-accent-red/10 hover:text-red-200 focus-visible:outline-accent-red'
          : 'text-white/65 hover:bg-white/[0.07] hover:text-white focus-visible:outline-accent-green'
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </button>
  );
}
