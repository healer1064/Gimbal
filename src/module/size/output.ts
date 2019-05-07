import bytes from 'bytes';
import { Report, ReportItem } from '@/typings/command';
import { ParsedSizeConfig, ParsedFile } from '@/typings/module/size';
import { CommandOptions } from '@/typings/utils/command';
import { truncatePath } from '@/utils/string';

const bytesConfig = { unitSeparator: ' ' };

interface ParseOptions {
  cwd: string;
  success: boolean;
}

const parseArray = (files: ParsedFile[], config: ParsedSizeConfig, options: ParseOptions): ReportItem[] =>
  files.map(
    (file: ParsedFile): ReportItem => ({
      label: truncatePath(file.path, options.cwd),
      rawLabel: file.path,
      rawThreshold: config.maxSizeBytes,
      rawValue: file.size,
      success: options.success,
      threshold: config.maxSize,
      thresholdLimit: 'upper',
      value: bytes(file.size, bytesConfig),
    }),
  );

const flatten = (arrays: ReportItem[][]): ReportItem[] =>
  arrays.reduce((acc: ReportItem[], val: ReportItem[]): ReportItem[] => acc.concat(val), []);

const parseReport = (raw: ParsedSizeConfig[], options: CommandOptions): Report => {
  const { checkThresholds, cwd } = options;
  const success: boolean = checkThresholds
    ? !raw.some((config: ParsedSizeConfig): boolean => config.failures.length > 0)
    : true;
  const data: ReportItem[] = flatten(
    raw.map(
      (config: ParsedSizeConfig): ReportItem[] => [
        ...parseArray(config.failures, config, { cwd, success: false }),
        ...parseArray(config.successes, config, { cwd, success: true }),
      ],
    ),
  );

  return {
    data: [
      {
        data,
        label: 'Size Checks',
        rawLabel: 'Size Checks',
        success,
      },
    ],
    raw,
    success,
  };
};

export default parseReport;
