
import { Client } from "@replit/object-storage";

const client = new Client();

export const storage = {
  async uploadFile(key: string, buffer: Buffer): Promise<void> {
    await client.uploadFromBytes(key, buffer);
  },

  async getPublicUrl(key: string): Promise<string> {
    // For Replit Object Storage, we return a URL that can be served through our API
    return `/api/storage/${key}`;
  },

  async downloadFile(key: string): Promise<Buffer> {
    const result = await client.downloadAsBytes(key);
    return Buffer.from(result);
  },

  async deleteFile(key: string): Promise<void> {
    await client.delete(key);
  },

  async listFiles(prefix?: string): Promise<string[]> {
    return await client.list({ prefix });
  }
};
