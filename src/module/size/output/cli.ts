import bytes from 'bytes';
import figlet from 'figlet';
import Table, { HorizontalTable } from 'cli-table3';
import { CommandReturn } from '@/typings/command';
import { ParsedSizeConfig, ParsedFile } from '@/typings/module/size';
import { CliOutputOptions } from '@/typings/output/cli';
import { CommandOptions } from '@/typings/utils/command';
import log from '@/utils/logger';
import { pad, truncatePath } from '@/utils/string';

const bytesConfig = { unitSeparator: ' ' };

const formatFile = (file: ParsedFile, maxSizeBytes: number): string => {
  const diff = file.size - maxSizeBytes;
  const diffBytes = bytes(Math.abs(diff), bytesConfig);
  const percentage = Math.abs((diff / maxSizeBytes) * 100);
  const prefix = diff > 0 ? '+' : '-';
  const difference = `${prefix}${diffBytes} (${prefix}${percentage.toFixed(2)} %)`;

  return `${file.path}
     Size: ${bytes(file.size, bytesConfig)}  │  Difference: ${difference}`;
};

const formatConfig = (config: ParsedSizeConfig, failures: boolean): string => {
  const files = failures ? config.failures : config.successes;
  const label = failures ? `failure${files.length === 1 ? '' : 's'}` : `success${files.length === 1 ? '' : 'es'}`;

  return `"${config.path}" has ${files.length} ${label}:
   Max Size: ${bytes(config.maxSizeBytes, bytesConfig)}
   ${files.map((file: ParsedFile): string => formatFile(file, config.maxSizeBytes)).join('\n')}`;
};

const outputVerbose = (failures: ParsedSizeConfig[], successes: ParsedSizeConfig[]): string[] => {
  const messages: string[] = [figlet.textSync('Size Check'), ` ${pad(80, '─')}`, ''];

  if (failures.length) {
    const message = failures
      .map((parsedConfig: ParsedSizeConfig): string => formatConfig(parsedConfig, true))
      .join('\n');

    messages.push('FAILURES:', message, '');
  }

  const message = successes
    .map((parsedConfig: ParsedSizeConfig): string => formatConfig(parsedConfig, false))
    .join('\n');

  messages.push('SUCCESSES:', message);

  return messages;
};

const outputTable = (
  failures: ParsedSizeConfig[],
  successes: ParsedSizeConfig[],
  commandOptions: CommandOptions,
  options?: CliOutputOptions,
): HorizontalTable => {
  const { cwd } = commandOptions;
  const table =
    options && options.table ? options.table : (new Table({ head: ['File', 'Size', 'Threshold'] }) as HorizontalTable);

  table.push([{ colSpan: 3, content: 'FAILURES' }]);

  if (failures.length) {
    failures.forEach(
      (failureConfig: ParsedSizeConfig): void => {
        failureConfig.failures.forEach(
          (failure: ParsedFile): void => {
            table.push([
              truncatePath(failure.path, cwd),
              { content: bytes(failure.size, bytesConfig), hAlign: 'right' },
              { content: failure.threshold, hAlign: 'right' },
            ]);
          },
        );
      },
    );
  } else {
    table.push([{ colSpan: 3, content: '  none' }]);
  }

  table.push([{ colSpan: 3, content: 'SUCCESSES' }]);

  if (successes.length) {
    successes.forEach(
      (successConfig: ParsedSizeConfig): void => {
        successConfig.successes.forEach(
          (success: ParsedFile): void => {
            table.push([
              truncatePath(success.path, cwd),
              { content: bytes(success.size, bytesConfig), hAlign: 'right' },
              { content: success.threshold, hAlign: 'right' },
            ]);
          },
        );
      },
    );
  } else {
    table.push([{ colSpan: 3, content: '  none' }]);
  }

  return table;
};

const cliOutput = (reports: CommandReturn, commandOptions: CommandOptions, options?: CliOutputOptions): void => {
  if (reports.data.length) {
    const failures: ParsedSizeConfig[] = [];
    const successes: ParsedSizeConfig[] = [];
    const { verbose } = commandOptions;

    reports.data.forEach(
      (report: ParsedSizeConfig): void => {
        if (report.failures.length > 0) {
          failures.push(report);
        } else {
          successes.push(report);
        }
      },
    );

    if (verbose) {
      const messages = outputVerbose(failures, successes);

      log(messages.join('\n'));
    }

    const table = outputTable(failures, successes, commandOptions, options);

    if (!options || !options.table) {
      // if a table wasn't passed in, output table
      // otherwise let whatever passed the table in
      // manage outputting the table
      log(table.toString());
    }
  }
};

export default cliOutput;
