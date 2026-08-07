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
  private baseUrl: string;
  private userAgent: string;

  constructor(config: { baseUrl?: string; userAgent?: string } = {}) {
    this.baseUrl = config.baseUrl || 'https://api.bgm.tv';
    this.userAgent = config.userAgent || 'BangumiAgentKit/0.1.0';
  }

  /**
   * getCalendar Operation (GET /calendar)
   */
  async getCalendar(): Promise<CalendarItem[]> {
    const url = `${this.baseUrl}/calendar`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar API Request Failed [${response.status}]: ${response.statusText}`);
    }

    return (await response.json()) as CalendarItem[];
  }
}
