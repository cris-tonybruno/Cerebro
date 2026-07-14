// Auth M1+M8: senha única (APP_PASSWORD) → cookie com SHA-256 amarrado à ÉPOCA.
// Blackout bumpa a época → todos os cookies vivos morrem na hora.

export const AUTH_COOKIE = "cerebro_auth";

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedToken(epoch: number): Promise<string> {
  return sha256Hex(`cerebro:${process.env.APP_PASSWORD}:${epoch}`);
}
