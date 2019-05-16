import sizeModule from '@/module/size';
import { Report } from '@/typings/command';
import { CommandOptions } from '@/typings/utils/command';

const sizeCommand = async (options: CommandOptions): Promise<Report> => sizeModule(options);

export default sizeCommand;
