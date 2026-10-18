import { startPocketBase } from '../../server/tests/harness';

export default async function () {
  const pb = await startPocketBase({ port: 8091 });
  return () => pb.stop();
}
