export interface CalendarAnimeItem {
  id: number;
  name: string;
  nameCn: string;
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
