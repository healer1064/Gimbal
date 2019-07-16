import envOrDefault from '@modus/gimbal-core/lib/utils/env';
import deepmerge from 'deepmerge';
import mysqlMod, { Connection, MysqlError } from 'mysql';
import { PluginOptions } from '@/typings/config/plugin';
import { GetEvent, SaveEvent } from '@/typings/plugin/last-value';
import { EnvOrDefault } from '@/typings/utils/env';

interface Base {
  commandPrefix?: string | string[];
  host?: string;
  password?: string;
  port?: number;
  strict?: boolean;
  user?: string;
}

interface Config extends Base {
  lastValue: Item;
}

interface ItemConfig extends Base {
  database: string;
  table: string;
}

type Item = boolean | ItemConfig;

const defaultConfig: Config = {
  lastValue: false,
  strict: true,
};

const createConnection = (config: ItemConfig, env: EnvOrDefault): Promise<Connection | void> =>
  new Promise((resolve, reject): void => {
    const connection = mysqlMod.createConnection({
      host: config.host || env('GIMBAL_MYSQL_HOST', 'localhost'),
      user: config.user || env('GIMBAL_MYSQL_USERNAME', 'root'),
      password: config.password || env('GIMBAL_MYSQL_PASSWORD'),
      port: config.port || env('GIMBAL_MYSQL_PORT', 3306),
      database: config.database,
      ssl: {
        // DO NOT DO THIS
        // set up your ca correctly to trust the connection
        rejectUnauthorized: false,
      },
    });

    // eslint-disable-next-line
    console.log(JSON.stringify(config, null, 2));
    // eslint-disable-next-line
    console.log(
      JSON.stringify(
        {
          host: config.host || env('GIMBAL_MYSQL_HOST', 'localhost'),
          user: config.user || env('GIMBAL_MYSQL_USERNAME', 'root'),
          password: config.password || env('GIMBAL_MYSQL_PASSWORD'),
          port: config.port || env('GIMBAL_MYSQL_PORT', 3306),
          database: config.database,
          ssl: {
            // DO NOT DO THIS
            // set up your ca correctly to trust the connection
            rejectUnauthorized: false,
          },
        },
        null,
        2,
      ),
    );

    connection.connect((error: MysqlError | null): void => {
      if (error) {
        if (config.strict) {
          reject(error);
        } else {
          resolve();
        }
      } else {
        resolve(connection);
      }
    });
  });

const mysql = async ({ bus }: PluginOptions, config: Config): Promise<void> => {
  const mysqlConfig = deepmerge(defaultConfig, config);

  if (mysqlConfig.lastValue) {
    const { getLastReport, init, saveLastReport } = await import('./last-value');
    const event = await bus('event');
    const itemConfig: ItemConfig = deepmerge(
      {
        ...mysqlConfig,
        database: 'gimbal',
        table: 'gimbal_archive',
      },
      mysqlConfig.lastValue === true ? {} : mysqlConfig.lastValue,
    );

    const connection = await createConnection(itemConfig, envOrDefault);

    await init(connection, itemConfig);

    event.on(
      'plugin/last-value/report/get',
      (_eventName: string, { command }: GetEvent): Promise<void> => getLastReport(command, connection, itemConfig),
    );

    event.on(
      'plugin/last-value/report/save',
      (_eventName: string, { command, report }: SaveEvent): Promise<void> =>
        saveLastReport(command, report, connection, itemConfig),
    );
  }
};

export default mysql;
