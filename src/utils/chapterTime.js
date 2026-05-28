/** Relative time for a chapter — always based on when it was published (created_at). */
export function getChapterTimeAgo(chapter) {
  const timestamp = chapter?.created_at?.time;
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor(diff / 60);
  if (days > 0) return `${days} hari`;
  if (hours > 0) return `${hours} jam`;
  if (minutes > 0) return `${minutes} menit`;
  return 'Baru saja';
}
