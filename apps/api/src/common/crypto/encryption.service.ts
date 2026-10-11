import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const fromEnv = config.get<string>('ENCRYPTION_KEY');
    if (fromEnv && fromEnv.length >= 32) {
      this.key = crypto.createHash('sha256').update(fromEnv).digest();
    } else {
      // فقط توسعه: در صورت نبود ENCRYPTION_KEY از JWT_SECRET مشتق می‌شود — در Production حتماً ENCRYPTION_KEY تنظیم کنید.
      const fallback = config.get<string>('JWT_SECRET') || 'dev-only-insecure-key';
      this.key = crypto.createHash('sha256').update(`workpulse-enc:${fallback}`).digest();
    }
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
