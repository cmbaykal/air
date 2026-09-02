import { pollPort, portOpen } from "./health.ts";
import { startNpx, stopProcess } from "./process.ts";

export function isHealthy(port: number): Promise<boolean> {
  return portOpen(port);
}

export async function startGateway(
  id: string,
  stdioCmd: string,
  env: Record<string, string>,
  port: number,
  opts: { timeoutMs?: number; extraArgs?: string[] } = {},
): Promise<void> {
  await startNpx(
    id,
    [
      "supergateway",
      "--stdio",
      stdioCmd,
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
      "--outputTransport",
      "streamableHttp",
      ...(opts.extraArgs ?? []),
    ],
    env,
  );
  if (!(await pollPort(port, opts.timeoutMs ?? 30_000))) {
    throw new Error(`${id} MCP ayağa kalkmadı. .run/${id}.log dosyasına bakın.`);
  }
}

export async function stopGateway(id: string, port: number): Promise<boolean> {
  return stopProcess(id, port);
}
