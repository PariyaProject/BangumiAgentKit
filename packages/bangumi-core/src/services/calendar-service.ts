import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainCalendarDay } from '../models/calendar.js';

interface RawCalendarDay {
  weekday?: { en?: string; cn?: string; ja?: string; id?: number };
  items?: Array<{
    id: number;
    name?: string;
    name_cn?: string;
    air_date?: string;
    rating?: { score?: number };
    images?: Record<string, string>;
  }>;
}

export class CalendarService {
  constructor(private client: HttpClient) {}

  async getCalendar(): Promise<DomainCalendarDay[]> {
    const raw = await this.client.request<RawCalendarDay[]>({
      method: 'GET',
      path: '/calendar',
      cacheContext: {
        operationId: 'getCalendar',
      },
      cacheTtlSeconds: 3600,
    });

    return (raw || []).map((day) => ({
      weekday: {
        en: day.weekday?.en || '',
        cn: day.weekday?.cn || '',
        ja: day.weekday?.ja || '',
        id: day.weekday?.id || 0,
      },
      items: (day.items || []).map((item) => ({
        id: item.id,
        name: item.name || '',
        nameCn: item.name_cn || item.name || '',
        airDate: item.air_date || '',
        score: item.rating?.score,
        images: item.images,
      })),
    }));
  }
}
