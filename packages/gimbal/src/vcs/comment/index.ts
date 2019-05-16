import whichCI from '@/ci';
import Config from '@/config';
import EventEmitter from '@/event';
import { outputTable } from '@/output/markdown';
import { Report, ReportItem } from '@/typings/command';
import { CommandOptions } from '@/typings/utils/command';
import { CommentStartEvent, CommentEndEvent } from '@/typings/vcs/comment';

const renderItem = (item: ReportItem, options: CommandOptions): string => {
  if (!item.data) {
    return '';
  }

  const numFailed = item.data.reduce(
    (num: number, dataItem: ReportItem): number => num + (dataItem.success ? 0 : 1),
    0,
  );

  return `<details><summary>${item.label} (${numFailed} failure${numFailed === 1 ? '' : 's'})</summary>
<p>

${outputTable(item, options)}

</p>
</details>`;
};

const vcsComment = async (report: Report, commandOptions: CommandOptions): Promise<void> => {
  if (report.data) {
    const comment = Config.get('configs.comment', commandOptions.comment);

    if (comment) {
      const ci = whichCI();

      if (ci) {
        const { vcs } = ci;

        if (vcs) {
          const markdown = report.data.map((item: ReportItem): string => renderItem(item, commandOptions)).join('\n\n');
          const trimmed = markdown.trim();

          if (trimmed) {
            const commentStartEvent: CommentStartEvent = {
              ci,
              comment: trimmed,
              vcs,
            };

            await EventEmitter.fire(`vcs/comment/start`, commentStartEvent);

            await vcs.comment(trimmed);

            const commentEndEvent: CommentEndEvent = {
              ci,
              comment: trimmed,
              vcs,
            };

            await EventEmitter.fire(`vcs/comment/end`, commentEndEvent);
          }
        }
      }
    }
  }
};

export default vcsComment;
