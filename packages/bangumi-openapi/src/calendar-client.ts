import { HttpClient, HttpClientConfig } from '@bangumi-agent-kit/bangumi-transport';

export interface CalendarItem {
  weekday: {
    en: string;
    cn: string;
    ja: string;
    id: number;
  };
  items: Array<{
    id: number;
    url: string;
    type: number;
    name: string;
    name_cn: string;
    summary: string;
    air_date: string;
    air_weekday: number;
    rating?: {
      total: number;
      count: Record<string, number>;
      score: number;
    };
    rank?: number;
    images?: {
      large?: string;
      common?: string;
      medium?: string;
      small?: string;
      grid?: string;
    };
    collection?: {
      doing: number;
    };
  }>;
}

export class CalendarClient {
  private transport: HttpClient;

  constructor(configOrTransport?: HttpClient | HttpClientConfig) {
    if (configOrTransport instanceof HttpClient) {
      this.transport = configOrTransport;
    } else {
      this.transport = new HttpClient(configOrTransport);
    }
  }

  /**
   * getCalendar Operation (GET /calendar)
   */
  async getCalendar(): Promise<CalendarItem[]> {
    return this.transport.request<CalendarItem[]>({
      method: 'GET',
      path: '/calendar',
    });
  }
}
