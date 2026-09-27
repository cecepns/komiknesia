export const REACTION_OPTIONS = [
  { id: 'senang', label: 'Senang', emoji: '😄', icon: 'smile' },
  { id: 'biasaAja', label: 'Biasa Aja', emoji: '😐', icon: 'meh' },
  { id: 'kecewa', label: 'Kecewa', emoji: '😕', icon: 'frown' },
  { id: 'marah', label: 'Marah', emoji: '😡', icon: 'angry' },
  { id: 'sedih', label: 'Sedih', emoji: '😢', icon: 'sad' },
];

export const emptyReactionCounts = () =>
  REACTION_OPTIONS.reduce((acc, { id }) => {
    acc[id] = 0;
    return acc;
  }, {});

export function sumReactionCounts(data) {
  if (!data || typeof data !== 'object') return 0;
  return REACTION_OPTIONS.reduce((sum, { id }) => sum + Number(data[id] || 0), 0);
}
