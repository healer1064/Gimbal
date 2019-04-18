// @ts-ignore
import brotliSize from 'brotli-size';
import bytes from 'bytes';
import globby from 'globby';
import gzipSize from 'gzip-size';
import Config from '@/config';
import { CommandReturn } from '@/typings/command';
import { SizeConfig, SizeConfigs, ParsedSizeConfig, ParsedFile } from '@/typings/module/size';
import { readFile, resolvePath, stats, getDirectorySize } from '@/utils/fs';
import defaultConfig from './default-config';

type CompressionMechanisms = 'brotli' | 'gzip' | undefined;

const getBundleSize = (source: Buffer, compression?: CompressionMechanisms): number => {
  switch (compression) {
    case 'brotli':
      return brotliSize.sync(source);
    case 'gzip':
      return gzipSize.sync(source);
    default:
      return Buffer.byteLength(source);
  }
};

const getFileSource = (path: string): Promise<Buffer> => readFile(path);

const getFileSize = async (path: string, compression: CompressionMechanisms): Promise<number> => {
  const source = await getFileSource(path);

  return getBundleSize(source, compression);
};

const getDirSize = async (path: string): Promise<number> => (await getDirectorySize(path)) as number;

const getFileResult = async (cwd: string, sizeConfig: SizeConfig, config: SizeConfigs): Promise<ParsedSizeConfig> => {
  const fullPath = resolvePath(cwd, config.path);
  const paths = await globby(fullPath, { expandDirectories: false, onlyFiles: false });
  const maxSizeBytes = bytes(config.maxSize);
  const failures: ParsedFile[] = [];
  const successes: ParsedFile[] = [];

  await Promise.all(
    paths.map(
      async (path: string): Promise<ParsedFile> => {
        const pathStats = await stats(path);
        const size: number = pathStats.isDirectory()
          ? await getDirSize(path)
          : await getFileSize(path, sizeConfig.compression);
        const fail = size > maxSizeBytes;
        const parsedFile: ParsedFile = { fail, path, size };

        if (fail) {
          failures.push(parsedFile);
        } else {
          successes.push(parsedFile);
        }

        return parsedFile;
      },
    ),
  );

  return {
    ...config,
    failures,
    fullPath,
    maxSizeBytes,
    successes,
  };
};

const sizeModule = async (
  cwd: string,
  sizeConfig: SizeConfig | SizeConfigs[] = Config.get('configs.size', defaultConfig),
): Promise<CommandReturn> => {
  if (!sizeConfig) {
    return Promise.resolve({
      data: [],
      success: true,
    });
  }

  const configObject: SizeConfig = Array.isArray(sizeConfig) ? { configs: sizeConfig } : sizeConfig;

  const data: ParsedSizeConfig[] = await Promise.all(
    configObject.configs.map(
      (config: SizeConfigs): Promise<ParsedSizeConfig> => getFileResult(cwd, configObject, config),
    ),
  );

  const success: boolean = !data.some((config: ParsedSizeConfig): boolean => config.failures.length > 0);

  return {
    data,
    success,
  };
};

export default sizeModule;
