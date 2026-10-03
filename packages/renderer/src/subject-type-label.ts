const SUBJECT_TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
  other: '其他',
};

export function subjectTypeLabel(value?: string): string {
  if (!value) return '未知媒介';
  return SUBJECT_TYPE_LABELS[value] || value;
}
