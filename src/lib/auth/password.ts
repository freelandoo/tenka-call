import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Hash corrompido ou de outro algoritmo devolve false — nunca derruba o login. */
export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
  } catch {
    return false;
  }
}
