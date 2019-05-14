import bytes from 'bytes';
import Table from '@/components/Table';
import { doesItemFail } from '@/plugin/last-value/util';
import { Config, LastReportItem } from '@/typings/plugin/last-value';

const bytesConfig = {
  unitSeparator: ' ',
};

const decimalize = (value: number): string => (value % 1 ? value.toFixed(2) : `${value}`);

export const renderDiffPercentage = (lastValue: string, item: LastReportItem): string => {
  const { lastValueChange, lastValueDiff } = item;

  if (lastValueChange && lastValueDiff) {
    const diffPrefix = lastValueDiff > 0 ? '+' : '';

    return `${lastValue}
  ${diffPrefix}${decimalize(lastValueChange)}%`;
  }

  return lastValue;
};

export const renderDifference = (lastValue: number, item: LastReportItem): string => {
  const diff = item.lastValueDiff;

  if (diff) {
    const diffPrefix = diff > 0 ? '+' : '';

    return `${lastValue}
${diffPrefix}${bytes(diff, bytesConfig)}`;
  }

  return `${lastValue}`;
};

export const addColumn = (table: Table | void, config: Config): void => {
  if (table) {
    const index = (table.findColumn((column): boolean => column.header === 'Value', true) as number) + 1;

    table.addColumn(
      {
        header: 'Last Value',
        key: 'lastValue',
        renderer: (lastValue: number | string, item: LastReportItem): string => {
          const failure = doesItemFail(item, config);

          switch (failure) {
            case 'number':
            case 'percentage':
            case 'size':
              return renderDifference(lastValue as number, item);
            case 'numberDiffPercentage':
            case 'percentageDiffPercentage':
            case 'sizeDiffPercentage':
              return renderDiffPercentage(lastValue as string, item);
            default:
              return lastValue ? `${lastValue}` : '';
          }
        },
      },
      index,
    );
  }
};
