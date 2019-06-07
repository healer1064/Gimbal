// @ts-ignore
import brotliSize from 'brotli-size';
import bytes from 'bytes';
import globby from 'globby';
import gzipSize from 'gzip-size';
import minimatch from 'minimatch';
import EventEmitter from '@modus/gimbal-core/lib/event';
import { readFile, resolvePath, stats, getDirectorySize } from '@modus/gimbal-core/lib/utils/fs';
import Config from '@/config';
import { Report } from '@/typings/command';
import {
  FileResult,
  SizeConfig,
  SizeConfigs,
  AuditStartEvent,
  AuditEndEvent,
  ReportStartEvent,
  ReportEndEvent,
} from '@/typings/module/size';
import { CommandOptions } from '@/typings/utils/command';
import defaultConfig from './default-config';
import parseReport from './output';

type CompressionMechanisms = 'brotli' | 'gzip' | undefined;

const getBundleSize = (source: Buffer, compression: CompressionMechanisms = 'gzip'): number => {
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

const findMatchingThreshold = (
  filePath: string,
  configObject: SizeConfig,
  options: CommandOptions,
): SizeConfigs | void =>
  configObject.threshold.find((threshold: SizeConfigs): boolean =>
    minimatch(filePath, resolvePath(options.cwd, threshold.path)),
  );

const getResult = async (
  filePath: string,
  configObject: SizeConfig,
  options: CommandOptions,
): Promise<FileResult | void> => {
  const threshold = findMatchingThreshold(filePath, configObject, options);

  if (threshold) {
    const maxSizeBytes = bytes(threshold.maxSize);
    const pathStats = await stats(filePath);
    const isDirectory = pathStats.isDirectory();
    const size: number = isDirectory
      ? await getDirSize(filePath)
      : await getFileSize(filePath, configObject.compression);

    return {
      filePath,
      isDirectory,
      maxSizeBytes,
      maxSize: threshold.maxSize,
      sizeBytes: size,
      size: bytes(size),
      thresholdPath: resolvePath(options.cwd, threshold.path),
    };
  }

  return undefined;
};

const sizeModule = async (
  options: CommandOptions,
  config: SizeConfig | SizeConfigs[] = Config.get('configs.size'),
): Promise<Report> => {
  const { cwd } = options;
  const sizeConfig = {
    ...defaultConfig,
    ...config,
  };
  const configObject: SizeConfig = Array.isArray(sizeConfig) ? { threshold: sizeConfig } : sizeConfig;

  const auditStartEvent: AuditStartEvent = {
    config: configObject,
    options,
  };

  await EventEmitter.fire(`module/size/audit/start`, auditStartEvent);

  const pathsGlobs: string[] = configObject.threshold.map((threshold: SizeConfigs): string =>
    resolvePath(cwd, threshold.path),
  );
  const paths = await globby(pathsGlobs, { expandDirectories: false, onlyFiles: false });
  const raw: (FileResult | void)[] = await Promise.all(
    paths.map((filePath: string): Promise<FileResult | void> => getResult(filePath, configObject, options)),
  );
  const audit: FileResult[] = raw.filter(Boolean) as FileResult[];

  const auditEndEvent: AuditEndEvent = {
    audit,
    config: configObject,
    options,
  };

  await EventEmitter.fire(`module/size/audit/end`, auditEndEvent);

  const reportStartEvent: ReportStartEvent = {
    audit,
    config: configObject,
    options,
  };

  await EventEmitter.fire(`module/size/report/start`, reportStartEvent);

  const report = parseReport(audit, options);

  const reportEndEvent: ReportEndEvent = {
    audit,
    config: configObject,
    options,
    report,
  };

  await EventEmitter.fire(`module/size/report/end`, reportEndEvent);

  return report;
};

export default sizeModule;
