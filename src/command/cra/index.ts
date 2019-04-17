import Table, { HorizontalTable } from 'cli-table3';
import figlet from 'figlet';
import { Metrics } from 'puppeteer';
import sizeModule from '@/module/size';
import sizeCliOutput from '@/module/size/output/cli';
import LighthouseModule from '@/module/lighthouse';
import lighthouseCliOutput from '@/module/lighthouse/output/cli';
import Chrome from '@/module/chrome';
import HeapSnapshot from '@/module/heap-snapshot';
import HeapSnapshotCliOutput from '@/module/heap-snapshot/output/cli';
import UnusedSource from '@/module/unused-source';
import unusedSourceCliOutput from '@/module/unused-source/output/cli';
import Serve from '@/module/serve';
import { ParsedSizeConfig } from '@/typings/module/size';
import { Result } from '@/typings/module/lighthouse';
import { UnusedRet } from '@/typings/module/unused-source';
import { CliOutputOptions } from '@/typings/output/cli';
import { CommandOptions } from '@/typings/utils/command';
import log from '@/utils/logger';
import findPort from '@/utils/port';

interface Rets {
  sizes?: ParsedSizeConfig[];
  heapSnapshots?: Metrics;
  lighthouse?: Result | void;
  unusedSource?: UnusedRet;
}

const calculateUnusedSource = async (chrome: Chrome, url: string): Promise<UnusedRet | void> => {
  const page = await chrome.newPage();

  if (page) {
    const unused = new UnusedSource();

    const ret = await unused.calculate(page, url);

    await page.close();

    return ret;
  }

  throw new Error('Could not open page to calculate unused source');
};

const takeHeapSnapshot = async (chrome: Chrome, url: string): Promise<Metrics | void> => {
  const page = await chrome.newPage();

  if (page) {
    return HeapSnapshot(page, url);
  }

  throw new Error('Could not open page to get heap snapshot');
};

const cra = async (options: CommandOptions): Promise<Rets> => {
  const rets: Rets = {};
  const table = new Table() as HorizontalTable;
  const cliOptions: CliOutputOptions = { table };
  // if we are going to calculate unused CSS, take heap snapshot(s) or run lighthouse audits
  // we need to host the app and use chrome
  const needChromeAndServe = options.calculateUnusedCss || options.heapSnapshot || options.lighthouse;

  const servePort = needChromeAndServe ? await findPort() : null;
  const localUri = servePort ? `http://localhost:${servePort}` : null;
  const serve = servePort ? new Serve({ port: servePort, public: `${options.cwd}/build` }) : null;
  const chrome = needChromeAndServe ? new Chrome() : null;

  if (serve) {
    await serve.start();
  }

  if (chrome) {
    await chrome.launch();
  }

  if (options.size) {
    const report = await sizeModule(options.cwd);

    table.push([{ colSpan: 2, content: 'Size' }]);

    sizeCliOutput(report, options, cliOptions);

    rets.sizes = report;
  }

  if (options.lighthouse && chrome && localUri) {
    const report = await LighthouseModule(localUri, {
      chromePort: chrome.port as string,
    });

    table.push([{ colSpan: 2, content: '' }], [{ colSpan: 2, content: 'Lighthouse' }]);

    lighthouseCliOutput(report, options, cliOptions);

    rets.lighthouse = report;
  }

  if (options.calculateUnusedSource && chrome && localUri) {
    const ret = await calculateUnusedSource(chrome, localUri);

    if (ret) {
      table.push([{ colSpan: 2, content: '' }], [{ colSpan: 2, content: 'Unused Source' }]);

      unusedSourceCliOutput(ret, options, cliOptions);

      rets.unusedSource = ret;
    }
  }

  if (options.heapSnapshot && chrome && localUri) {
    const ret = await takeHeapSnapshot(chrome, localUri);

    if (ret) {
      table.push([{ colSpan: 2, content: '' }], [{ colSpan: 2, content: 'Heap Snapshot' }]);

      HeapSnapshotCliOutput(ret, options, cliOptions);

      rets.heapSnapshots = ret;
    }
  }

  if (chrome) {
    await chrome.kill();
  }

  if (serve) {
    await serve.stop();
  }

  const craBanner = figlet.textSync('Create React App');

  log(craBanner);

  log(table.toString());

  return rets;
};

export default cra;
