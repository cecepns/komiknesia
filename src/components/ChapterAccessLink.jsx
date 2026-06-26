import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requiresChapterLogin } from '../utils/chapterAccess';
import LoginModal from './LoginModal';

const ACCENT_BORDER = {
  blue: 'border-l-blue-500',
  violet: 'border-l-violet-500',
};

export function getChapterAccessLinkClassName({
  locked,
  accent = 'blue',
  className = '',
  compact = false,
}) {
  const base = compact
    ? 'inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors md:text-sm'
    : 'flex w-full items-center justify-between rounded-lg border-l-[3px] px-2.5 py-2 text-xs text-left transition-colors sm:px-3';

  const unlocked = compact
    ? 'border-slate-200 bg-slate-50 text-slate-800 shadow-[0_2px_0_0_#e2e8f0] hover:-translate-y-px hover:bg-white hover:shadow-[0_3px_0_0_#cbd5e1] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_2px_0_0_#1e3a5f] dark:hover:bg-primary-700'
    : `border border-transparent ${ACCENT_BORDER[accent] || ACCENT_BORDER.blue} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-primary-800/70 dark:text-gray-300 dark:hover:bg-primary-700`;

  const lockedCls = compact
    ? 'border-amber-500/35 bg-slate-900/95 text-amber-50 shadow-[0_2px_0_0_rgba(245,158,11,0.35)] dark:border-amber-400/40 dark:bg-[#0b1f3a]/95 dark:text-amber-50'
    : 'border border-amber-500/25 border-l-[3px] border-l-amber-500 bg-slate-900/95 text-gray-100 shadow-sm hover:bg-slate-900 dark:border-amber-400/30 dark:border-l-amber-400 dark:bg-[#0b1f3a]/95 dark:text-gray-100 dark:hover:bg-[#0a1a30]';

  return [base, locked ? lockedCls : unlocked, className].filter(Boolean).join(' ');
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
  const [loginOpen, setLoginOpen] = useState(false);
  const locked = requiresChapterLogin(chapter, isAuthenticated);

  const handleClick = (e) => {
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      setLoginOpen(true);
      return;
    }
    onClick?.(e);
  };

  const linkClassName = getChapterAccessLinkClassName({
    locked,
    accent,
    className,
    compact,
  });

  const labelNode = label ?? children;

  return (
    <>
      <Link to={to} onClick={handleClick} className={linkClassName} {...rest}>
        {label != null || meta != null ? (
          <>
            <span className="flex min-w-0 items-center gap-1.5 font-semibold">
              <span className="truncate">{label}</span>
              {locked && showLockIcon ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400 dark:text-amber-300" aria-hidden />
              ) : null}
            </span>
            {meta ? (
              <span
                className={`shrink-0 pl-2 text-[11px] md:text-xs ${
                  locked ? 'text-amber-200/75 dark:text-amber-200/70' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {meta}
              </span>
            ) : null}
          </>
        ) : (
          labelNode
        )}
      </Link>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
};

export default ChapterAccessLink;
