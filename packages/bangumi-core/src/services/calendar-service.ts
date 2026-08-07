import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainCalendarDay } from '../models/calendar.js';

export class CalendarService {
  constructor(private client: HttpClient) {}

  async getCalendar(): Promise<DomainCalendarDay[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: '/calendar',
      cacheContext: {
        operationId: 'getCalendar',
      },
      cacheTtlSeconds: 3600,
    });

    return (raw || []).map((day: any) => ({
      weekday: {
        en: day.weekday?.en || '',
        cn: day.weekday?.cn || '',
        ja: day.weekday?.ja || '',
        id: day.weekday?.id || 0,
      },
      items: (day.items || []).map((item: any) => ({
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
