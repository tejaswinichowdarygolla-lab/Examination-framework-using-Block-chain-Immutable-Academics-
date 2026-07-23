import { create, type KuboRPCClient } from 'kubo-rpc-client';
import { ENV } from '@/config/env';

let _client: KuboRPCClient | null = null;

export function getIPFSClient(): KuboRPCClient {
  const url = ENV.IPFS_API;
  if (!_client || (_client as any)._lastUrl !== url) {
    _client = create({ url: new URL(url) });
    (_client as any)._lastUrl = url;
    console.log(`[IPFS] Client initialized at: ${url}`);
  }
  return _client;
}

export async function checkIPFSConnection(): Promise<{
  ok: boolean;
  peerId?: string;
  version?: string;
  error?: string;
}> {
  try {
    const client = getIPFSClient();
    const id = await client.id();
    const ver = await client.version();
    return {
      ok: true,
      peerId: id.id.toString(),
      version: ver.version,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'IPFS unreachable' };
  }
}

export async function ipfsAdd(
  content: string | Uint8Array,
  pin = true,
): Promise<string> {
  const client = getIPFSClient();
  const result = await client.add(content, { pin });
  return result.cid.toString();
}

export async function ipfsCat(cid: string): Promise<string> {
  const client = getIPFSClient();
  const chunks: Uint8Array[] = [];
  for await (const chunk of client.cat(cid)) {
    chunks.push(chunk as Uint8Array);
  }
  const total = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(total);
}

export async function ipfsPin(cid: string): Promise<void> {
  const client = getIPFSClient();
  await client.pin.add(cid);
}

