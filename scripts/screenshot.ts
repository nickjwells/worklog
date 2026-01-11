import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOTS_DIR = join(__dirname, '../screenshots');
const DEV_URL = process.env.DEV_URL || 'http://localhost:4321';

interface ScreenshotOptions {
  name?: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
}

async function takeScreenshot(options: ScreenshotOptions = {}): Promise<string> {
  const {
    name = `screenshot-${Date.now()}`,
    width = 1200,
    height = 800,
    fullPage = true,
  } = options;

  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(DEV_URL, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const screenshotPath = join(SCREENSHOTS_DIR, `${name}.png`);

    await page.screenshot({
      path: screenshotPath,
      fullPage,
    });

    console.log(`Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } finally {
    await browser.close();
  }
}

const PRESETS: Record<string, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    for (const [preset, dimensions] of Object.entries(PRESETS)) {
      await takeScreenshot({ name: `worklog-${preset}`, ...dimensions });
    }
  } else {
    const presetArg = args.find(arg => arg.startsWith('--preset='));
    const preset = presetArg?.split('=')[1];

    if (preset && PRESETS[preset]) {
      await takeScreenshot({ name: `worklog-${preset}`, ...PRESETS[preset] });
    } else {
      await takeScreenshot({ name: args[0] || 'worklog-desktop', width: 1200, height: 800 });
    }
  }
}

main().catch(console.error);
