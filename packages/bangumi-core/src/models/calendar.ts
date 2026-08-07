export interface CalendarAnimeItem {
  id: number;
  name: string;
  nameCn: string;
  airDate: string;
  score?: number;
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
