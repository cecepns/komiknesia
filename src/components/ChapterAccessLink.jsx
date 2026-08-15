import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requiresChapterLogin } from '../utils/chapterAccess';
import LoginModal from './LoginModal';

export function getChapterAccessLinkClassName({
  locked,
  className = '',
  compact = false,
}) {
  const base = compact
    ? 'relative inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-all md:text-sm'
    : 'relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-all sm:px-3';

  const unlocked = compact
    ? 'chapter-border-anim chapter-border-unlocked bg-[#0f0f14] text-slate-200 dark:bg-black dark:text-white'
    : 'chapter-border-anim chapter-border-unlocked bg-[#0f0f14] text-gray-200 dark:bg-black dark:text-white';

  const lockedCls = compact
    ? 'chapter-border-anim chapter-border-locked bg-black text-amber-50 dark:bg-black dark:text-amber-50'
    : 'chapter-border-anim chapter-border-locked bg-black text-gray-100 dark:bg-black dark:text-gray-100';

  return [base, locked ? lockedCls : unlocked, className].filter(Boolean).join(' ');
}

/* ── Shared RAF loop for all chapter border animations ── */
let rafId = null;
let subscribers = new Set();
let angle = 0;

function tick(timestamp) {
  // ~120 deg/sec → full rotation in ~3s
  angle = (timestamp * 0.12) % 360;
  for (const cb of subscribers) cb(angle);
  rafId = requestAnimationFrame(tick);
}

function subscribe(cb) {
  subscribers.add(cb);
  if (subscribers.size === 1) {
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

const ChapterAccessLink = ({
  chapter,
  to,
  className = '',
  label,
  meta,
  accent = 'blue',
  compact = false,
  children,
  onClick,
  showLockIcon = true,
  ...rest
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const locked = requiresChapterLogin(chapter, isAuthenticated);
  const elRef = useRef(null);

  /* Subscribe to shared RAF animation loop */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    return subscribe((a) => {
      el.style.setProperty('--border-angle', `${a}deg`);
    });
  }, []);

  /* Block ALL event types from reaching parent card containers */
  const stopAllPropagation = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();

    if (locked) {
      setLoginOpen(true);
      return;
    }
    onClick?.(e);
  };

  const linkClassName = getChapterAccessLinkClassName({
    locked,
    className,
    compact,
  });

  const labelNode = label ?? children;

  if (locked) {
    return (
      /* This wrapper div blocks ALL event types from bubbling to parent card onClick */
      <div
        onClick={stopAllPropagation}
        onMouseDown={stopAllPropagation}
        onMouseUp={stopAllPropagation}
        onPointerDown={stopAllPropagation}
        onPointerUp={stopAllPropagation}
        onTouchStart={stopAllPropagation}
        onTouchEnd={stopAllPropagation}
      >
        <button
          type="button"
          ref={elRef}
          onClick={handleClick}
          className={linkClassName}
          style={{ '--border-angle': '0deg' }}
          {...rest}
        >
          {label != null || meta != null ? (
            <>
              <span className="relative z-10 flex min-w-0 items-center gap-2 font-semibold">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                <span className="truncate text-amber-300">{label}</span>
                {showLockIcon ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400 dark:text-amber-300" aria-hidden />
                ) : null}
              </span>
              {meta ? (
                <span className="relative z-10 shrink-0 pl-2 text-[11px] md:text-xs text-amber-200/75 dark:text-amber-200/70">
                  {meta}
                </span>
              ) : null}
            </>
          ) : (
            labelNode
          )}
        </button>
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setLoginOpen(false);
            if (to) navigate(to);
          }}
        />
      </div>
    );
  }

  return (
    <Link
      ref={elRef}
      to={to}
      onClick={handleClick}
      className={linkClassName}
      style={{ '--border-angle': '0deg' }}
      {...rest}
    >
      {label != null || meta != null ? (
        <>
          <span className="relative z-10 flex min-w-0 items-center gap-2 font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-600 shadow-[0_0_6px_#dc2626]" />
            <span className="truncate text-gray-700 dark:text-white">{label}</span>
          </span>
          {meta ? (
            <span className="relative z-10 shrink-0 pl-2 text-[11px] md:text-xs text-gray-500 dark:text-gray-400">
              {meta}
            </span>
          ) : null}
        </>
      ) : (
        labelNode
      )}
    </Link>
  );
};

export default ChapterAccessLink;
