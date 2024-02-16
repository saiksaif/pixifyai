import { Pool, types } from 'pg';
import { isProd } from '~/env/other';
import { env } from '~/env/server.mjs';

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var globalPgRead: Pool | undefined;
  // eslint-disable-next-line no-var, vars-on-top
  var globalPgWrite: Pool | undefined;
}

function getClient({ readonly }: { readonly: boolean } = { readonly: false }) {
  console.log('Creating PG client');
  const connectionStringUrl = new URL(readonly ? env.DATABASE_REPLICA_URL : env.DATABASE_URL);
  connectionStringUrl.searchParams.set('sslmode', 'no-verify');
  const connectionString = connectionStringUrl.toString();

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT,
  });

  return pool;
}

types.setTypeParser(types.builtins.TIMESTAMP, function (stringValue) {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

export let pgDbWrite: Pool;
export let pgDbRead: Pool;
const singleClient = env.DATABASE_REPLICA_URL === env.DATABASE_URL;
if (isProd) {
  pgDbWrite = getClient();
  pgDbRead = singleClient ? pgDbWrite : getClient({ readonly: true });
} else {
  if (!global.globalPgWrite) global.globalPgWrite = getClient();
  if (!global.globalPgRead)
    global.globalPgRead = singleClient ? global.globalPgWrite : getClient({ readonly: true });
  pgDbWrite = global.globalPgWrite;
  pgDbRead = global.globalPgRead;
}
