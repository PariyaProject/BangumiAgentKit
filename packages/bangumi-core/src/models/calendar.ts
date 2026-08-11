export interface CalendarAnimeItem {
  id: number;
  name: string;
  nameCn: string;
  /** True only when the upstream supplied a non-empty Chinese title. */
  nameCnProvided?: boolean;
  airDate: string;
  airWeekday?: number;
  type?: number;
  typeLabel?: string;
  summary?: string;
  score?: number;
  rank?: number;
  collectionDoing?: number;
  images?: Record<string, string>;
}

export interface DomainCalendarDay {
  weekday: {
    en: string;
    cn: string;
    ja: string;
    id: number;
  };
  items: CalendarAnimeItem[];
}
