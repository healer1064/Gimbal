import minimatch from 'minimatch';
import { CoverageEntry, Page } from 'puppeteer';
import { URL } from 'url';
import Config from '@/config';
import { Report } from '@/typings/command';
import { SizeConfigs } from '@/typings/module/size';
import { CoverageRange, Entry, UnusedSourceConfig } from '@/typings/module/unused-source';
import { CommandOptions } from '@/typings/utils/command';
import defaultConfig from './default-config';
import parseReport from './output';

interface CheckThresholdRet {
  success: boolean;
  threshold?: string;
}

type EntryType = 'css' | 'js' | undefined;

const isThresholdMatch = (url: string, threshold: SizeConfigs, type?: EntryType): boolean => {
  // only attempt to find a match if both types match
  if (threshold.type === type) {
    const info = new URL(url);

    // use the pathname, not the whole url to make the
    // threshold path config simpler
    return minimatch(info.pathname, threshold.path);
  }

  return false;
};

const getThreshold = (url: string, thresholds: SizeConfigs[], type?: EntryType): string | void => {
  // attempt to find a matching threshold
  const threshold = thresholds.find((item: SizeConfigs): boolean => isThresholdMatch(url, item, type));

  if (threshold) {
    return threshold.maxSize;
  }

  // if no threshold was found, if there was a type passed, let's try
  // to find a threshold match that doesn't have a type on it.
  return type ? getThreshold(url, thresholds) : undefined;
};

const checkThreshold = (percentage: number, threshold?: string): CheckThresholdRet => {
  if (threshold == null) {
    // if no threshold, then this is valid
    return {
      success: true,
    };
  }

  // threshold is a percentage as a string
  // remove % off end
  const thresholdNum = (threshold as string).substr(0, (threshold as string).length - 1);

  return {
    success: percentage >= Number(thresholdNum),
    threshold,
  };
};

const getEntryUsed = (entry: CoverageEntry): number =>
  entry.ranges.reduce((used: number, range: CoverageRange): number => used + range.end - range.start - 1, 0);

const UnusedCSS = async (
  page: Page,
  url: string,
  options: CommandOptions,
  config: UnusedSourceConfig = Config.get('configs.unused-source', defaultConfig),
): Promise<Report> => {
  const { checkThresholds } = options;
  const sourceConfig = {
    ...defaultConfig,
    ...config,
  };

  const isThresholdArray = Array.isArray(sourceConfig.threshold);

  await Promise.all([page.coverage.startCSSCoverage(), page.coverage.startJSCoverage()]);

  await page.goto(url);

  const [css, js]: [CoverageEntry[], CoverageEntry[]] = await Promise.all([
    page.coverage.stopCSSCoverage(),
    page.coverage.stopJSCoverage(),
  ]);

  let total = 0;
  let used = 0;

  const parseEntry = (type: EntryType): ((entry: CoverageEntry) => Entry) => (entry: CoverageEntry): Entry => {
    const entryTotal = entry.text.length;
    const entryUsed = getEntryUsed(entry);

    total += entryTotal;
    used += entryUsed;

    const unused = entryTotal - entryUsed;
    const percentage = (unused / entryTotal) * 100;
    const threshold = isThresholdArray
      ? getThreshold(entry.url, sourceConfig.threshold as SizeConfigs[], type)
      : (sourceConfig.threshold as string);
    const checked = checkThresholds ? checkThreshold(percentage, threshold as string) : { success: true };

    return {
      ...checked,
      total: entryTotal,
      unused,
      unusedPercentage: `${percentage.toFixed(2)}%`,
      url: entry.url,
      used: entryUsed,
    };
  };

  const parsedCss = css.map(parseEntry('css'));
  const parsedJs = js.map(parseEntry('js'));

  const unused = total - used;
  const percentage = (unused / total) * 100;
  const threshold = isThresholdArray
    ? getThreshold(url, sourceConfig.threshold as SizeConfigs[])
    : (sourceConfig.threshold as string);
  const checked = checkThresholds ? checkThreshold(percentage, threshold as string) : { success: true };
  const pageTotal: Entry = {
    ...checked,
    total,
    unused,
    unusedPercentage: `${percentage.toFixed(2)}%`,
    url,
    used,
  };

  const data: Entry[] = [pageTotal, ...parsedCss, ...parsedJs];

  return parseReport(data, options);
};

export default UnusedCSS;
