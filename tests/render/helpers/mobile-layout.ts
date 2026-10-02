import { createRequire } from 'node:module';

interface LayoutRoot {
  clientWidth: number;
  scrollWidth: number;
  getBoundingClientRect(): { left: number; right: number };
  querySelectorAll(selector: string): ArrayLike<LayoutNode>;
}

interface LayoutNode {
  tagName: string;
  className: string;
  textContent: string | null;
  clientWidth: number;
  scrollWidth: number;
  getBoundingClientRect(): { left: number; right: number };
}

interface LayoutMeasurement {
  clientWidth: number;
  scrollWidth: number;
  overflowing: Array<{
    tagName: string;
    className: string;
    left: number;
    right: number;
    clientWidth: number;
    scrollWidth: number;
    text: string;
  }>;
}

interface Page {
  setContent(html: string, options: { waitUntil: 'domcontentloaded' }): Promise<void>;
  locator(selector: string): {
    evaluate<T>(callback: (element: LayoutRoot) => T): Promise<T>;
  };
}

interface BrowserContext {
  route(
    pattern: string,
    handler: (route: { abort(): Promise<void> }) => Promise<void>,
  ): Promise<void>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

interface Browser {
  newContext(options: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    javaScriptEnabled: boolean;
    serviceWorkers: 'block';
  }): Promise<BrowserContext>;
  close(): Promise<void>;
}

const rendererRequire = createRequire(__filename);
const rendererPackagePath = rendererRequire.resolve('../../../packages/renderer/package.json');
const loadRendererDependency = createRequire(rendererPackagePath);
const { chromium } = loadRendererDependency('playwright') as {
  chromium: {
    launch(options: { headless: boolean; args: string[] }): Promise<Browser>;
  };
};

let browserPromise: Promise<Browser> | undefined;

export async function measureRenderRootLayout(
  html: string,
  width: number,
): Promise<LayoutMeasurement> {
  browserPromise ??= chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-dev-shm-usage'],
  });
  const browser = await browserPromise;
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 2,
    javaScriptEnabled: false,
    serviceWorkers: 'block',
  });

  try {
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return await page.locator('[data-render-root]').evaluate((root) => {
      const rootBounds = root.getBoundingClientRect();
      const overflowing = Array.from(root.querySelectorAll('*'))
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            tagName: element.tagName,
            className: String(element.className),
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            text: (element.textContent ?? '').trim().slice(0, 80),
          };
        })
        .filter(
          (element) => element.left < rootBounds.left - 1 || element.right > rootBounds.right + 1,
        )
        .slice(0, 10);
      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        overflowing,
      };
    });
  } finally {
    await context.close();
  }
}

export async function closeMobileLayoutBrowser(): Promise<void> {
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser?.close();
}
