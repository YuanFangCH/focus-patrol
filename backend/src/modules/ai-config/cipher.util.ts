import * as crypto from 'crypto';

/**
 * AI key 加密工具: aes-256-gcm
 * 加密密钥由 JWT_SECRET 的 sha256 派生(零新增环境变量, JWT_SECRET 已强随机)
 * 密文格式: v1:iv:tag:data (base64), 存 ai_configs.api_key_cipher
 */

const PREFIX = 'v1';

/** 由 JWT_SECRET 派生 32 字节加密密钥 */
export function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/** 加密明文 → v1:iv:tag:data */
export function encrypt(key: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/** 解密 v1:iv:tag:data → 明文; 格式非法/密钥错误返回 null */
export function decrypt(key: Buffer, payload: string): string | null {
  try {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}
