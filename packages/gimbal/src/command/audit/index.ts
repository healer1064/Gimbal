import { resolvePath } from '@modus/gimbal-core/lib/utils/fs';
import Queue from '@modus/gimbal-core/lib/utils/Queue';
import findPort from '@modus/gimbal-core/lib/utils/port';
import sizeModule from '@/module/size';
import LighthouseModule from '@/module/lighthouse';
import Chrome from '@/module/chrome';
import HeapSnapshot from '@/module/heap-snapshot';
import UnusedSource from '@/module/unused-source';
import Serve from '@/module/serve';
import { Report, ReportItem } from '@/typings/command';
import { CommandOptions } from '@/typings/utils/command';

interface AuditOptions {
  chrome?: Chrome;
  url?: string;
}

const calculateUnusedSource = async (chrome: Chrome, url: string, options: CommandOptions): Promise<Report | void> => {
  const page = await chrome.newPage();

  if (page) {
    const report = await UnusedSource(page, url, options);

    await page.close();

    return report;
  }

  throw new Error('Could not open page to calculate unused source');
};

const takeHeapSnapshot = async (chrome: Chrome, url: string, options: CommandOptions): Promise<Report | void> => {
  const page = await chrome.newPage();

  if (page) {
    return HeapSnapshot(page, url, options);
  }

  throw new Error('Could not open page to get heap snapshot');
};

const doAudit = async (options: AuditOptions, commandOptions: CommandOptions): Promise<Report> => {
  const { chrome, url } = options;
  const rets: ReportItem[] = [];
  let success = true;

  if (commandOptions.size) {
    const report = await sizeModule(commandOptions);

    if (!report.success) {
      success = false;
    }

    if (report.data) {
      rets.push(...report.data);
    }
  }

  if (commandOptions.lighthouse && chrome && url) {
    const report = await LighthouseModule(
      url,
      {
        chromePort: chrome.port as string,
      },
      commandOptions,
    );

    if (!report.success) {
      success = false;
    }

    if (report.data) {
      rets.push(...report.data);
    }
  }

  if (commandOptions.calculateUnusedSource && chrome && url) {
    const report = await calculateUnusedSource(chrome, url, commandOptions);

    if (report) {
      if (!report.success) {
        success = false;
      }

      if (report.data) {
        rets.push(...report.data);
      }
    }
  }

  if (commandOptions.heapSnapshot && chrome && url) {
    const report = await takeHeapSnapshot(chrome, url, commandOptions);

    if (report) {
      if (!report.success) {
        success = false;
      }

      if (report.data) {
        rets.push(...report.data);
      }
    }
  }

  return {
    data: rets,
    success,
  };
};

const audit = async (options: CommandOptions): Promise<Report | Report[]> => {
  // if we are going to calculate unused CSS, take heap snapshot(s) or run lighthouse audits
  // we need to host the app and use chrome
  const needChromeAndServe = options.calculateUnusedSource || options.heapSnapshot || options.lighthouse;

  const servePort = needChromeAndServe ? await findPort() : null;
  const buildDir = resolvePath(options.cwd, options.buildDir as string);
  const serve = servePort ? new Serve({ port: servePort, public: buildDir }) : null;
  const chrome = needChromeAndServe ? new Chrome() : undefined;

  let report: Report | Report[];

  if (serve) {
    await serve.start();
  }

  if (chrome) {
    await chrome.launch();
  }

  if (Array.isArray(options.route)) {
    const queue = new Queue();

    options.route.forEach((route: string, index: number): void => {
      queue.add(
        (): Promise<Report> =>
          doAudit(
            {
              chrome,
              url: servePort ? `http://localhost:${servePort}${route}` : undefined,
            },
            {
              ...options,
              route,
              // if we will run size module, we should only do it once since
              // it won't change across multiple runs
              size: options.size && index === 0,
            },
          ),
      );
    });

    report = (await queue.run()) as Report[];
  } else {
    report = await doAudit(
      {
        chrome,
        url: servePort ? `http://localhost:${servePort}${options.route}` : undefined,
      },
      options,
    );
  }

  if (chrome) {
    await chrome.kill();
  }

  if (serve) {
    await serve.stop();
  }

  return report;
};

export default audit;
