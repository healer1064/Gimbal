import { resolvePath } from '@modus/gimbal-core/lib/utils/fs';
import { register } from '@modus/gimbal-core/lib/module/registry';
import bytes from 'bytes';
import globby from 'globby';
import minimatch from 'minimatch';
import explore, { ExploreBundleResult, ExploreResult } from 'source-map-explorer';
import { Report, ReportItem } from '@/typings/command';
import { Options } from '@/typings/module/registry';
import { BundleObject, BundleType, Config, meta, type } from './config';

type RunModuleFn = (options: Options) => Promise<Report>;

interface RawReport extends ExploreResult {
  bundle: string;
}

const bytesConfig = { unitSeparator: ' ' };

export const getThreshold = (file: string, bundleConfig: BundleType): string | undefined => {
  if (typeof bundleConfig === 'string') {
    return undefined;
  }

  const key = Object.keys(bundleConfig.thresholds).find((threshold: string): boolean => minimatch(file, threshold));

  return key && bundleConfig.thresholds[key];
};

export const parseBundle = (rawBundle: RawReport, bundleConfig: BundleType): ReportItem => {
  const data: ReportItem[] = [];
  let success = true;

  rawBundle.bundles.forEach((bundleResult: ExploreBundleResult): void => {
    Object.keys(bundleResult.files).forEach((file: string): void => {
      const size = bundleResult.files[file];
      const threshold = getThreshold(file, bundleConfig as BundleObject);
      const rawThreshold = threshold == null ? threshold : bytes(threshold);
      const fileSuccess = rawThreshold == null ? true : size <= rawThreshold;

      if (success) {
        success = fileSuccess;
      }

      data.push({
        label: file,
        rawLabel: file,
        rawThreshold,
        rawValue: size,
        success: fileSuccess,
        threshold,
        type,
        value: bytes(size, bytesConfig),
      });
    });
  });

  return {
    data,
    label: rawBundle.bundle,
    rawLabel: rawBundle.bundle,
    success,
    type,
  };
};

export const runModule = (pluginConfig: Config): RunModuleFn => async ({
  commandOptions,
}: Options): Promise<Report> => {
  const globBase = resolvePath(commandOptions.cwd, commandOptions.buildDir as string);
  const globs: string[] = pluginConfig.bundles.map((glob: BundleType): string => {
    const normalizedGlob: BundleObject = typeof glob === 'string' ? { path: glob, thresholds: {} } : glob;
    const { path } = normalizedGlob;

    // need to move the ! to the front so globby can ignore it
    return path[0] === '!' ? `!${resolvePath(globBase, path.substr(1))}` : resolvePath(globBase, path);
  });

  const paths = await globby(globs);
  const raw = await Promise.all(
    paths.map(
      async (bundle: string): Promise<false | RawReport> => {
        try {
          // SME will complain if sourcemaps contain just one file, but we don't control that
          // in bundles generated by 3rd parties like webpack runtime or Ionic
          const explored = await explore(bundle);

          return {
            bundle,
            ...explored,
          };
        } catch {
          return false;
        }
      },
    ),
  );

  const data = [
    ...(raw as RawReport[]).filter(Boolean).map(
      (entry: RawReport): ReportItem => {
        const globMatch = globs.find((glob: string): boolean => minimatch(entry.bundle, glob));
        const index = globs.indexOf(globMatch as string);
        const bundleConfig = pluginConfig.bundles[index];

        return parseBundle(entry, bundleConfig);
      },
    ),
  ];
  const success = data.every((item: ReportItem): boolean => item.success);

  return {
    data: [
      {
        data,
        label: 'Source Map Explorer Audits',
        rawLabel: 'Source Map Explorer Audits',
        success,
        type,
      },
    ],
    raw,
    success,
  };
};

export const registerModule = (pluginConfig: Config): void => register(type, meta, runModule(pluginConfig));