import action from './index';
import Command from '@/command';

// eslint-disable-next-line no-new
export default new Command({
  action,
  command: 'lighthouse',
  options: [
    {
      description: 'Location to output the lighthouse HTML report to.',
      flag: '--lighthouse-output-html [file]',
    },
    {
      defaultValue: '/',
      description: 'Route to run tests on.',
      flag: '--route <route>',
    },
  ],
  title: 'Lighthouse Audits',
});
