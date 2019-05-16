import deepmerge from 'deepmerge';
import mysqlMod, { Connection, MysqlError } from 'mysql';
import { PluginOptions } from '@/typings/config/plugin';
import envOrDefault from '@/utils/env';

interface ItemConfig {
  database: string;
  table: string;
}

type Item = boolean | ItemConfig;

interface Config {
  lastValue: Item;
}

const defaultConfig: Config = {
  lastValue: false,
};

const createConnection = (config: ItemConfig): Promise<Connection> =>
  new Promise(
    (resolve, reject): void => {
      const connection = mysqlMod.createConnection({
        host: envOrDefault('GIMBAL_MYSQL_HOST', 'localhost'),
        user: envOrDefault('GIMBAL_MYSQL_USERNAME', 'root'),
        password: envOrDefault('GIMBAL_MYSQL_PASSWORD'),
        database: config.database,
      });

      connection.connect(
        (error: MysqlError | null): void => {
          if (error) {
            reject(error);
          } else {
            resolve(connection);
          }
        },
      );
    },
  );

const mysql = async ({ event }: PluginOptions, config: Config): Promise<void> => {
  const mysqlConfig = deepmerge(defaultConfig, config);

  if (mysqlConfig.lastValue) {
    const { getLastReport, init, saveLastReport } = await import('./last-value');
    const itemConfig: ItemConfig = deepmerge(
      {
        ...mysqlConfig,
        database: 'gimbal',
        table: 'gimbal_archive',
      },
      mysqlConfig.lastValue === true ? {} : mysqlConfig.lastValue,
    );

    const connection = await createConnection(itemConfig);

    await init(connection, itemConfig);

    event.on(
      'plugin/last-value/report/get',
      (eventName, { command }): Promise<void> => getLastReport(command, connection, itemConfig),
    );

    event.on(
      'plugin/last-value/report/save',
      (eventName, { command, report }): Promise<void> => saveLastReport(command, report, connection, itemConfig),
    );
  }
};

export default mysql;
