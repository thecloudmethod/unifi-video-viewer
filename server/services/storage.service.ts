import { Injectable, OnModuleInit } from '@nestjs/common';
import * as storage from 'node-persist';

@Injectable()
export class StorageService implements OnModuleInit {
  async onModuleInit() {
    await storage.init({
        dir: './storage/',
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,  // can also be custom logging function
        ttl: false, // ttl* [NEW], can be true for 24h default or a number in MILLISECONDS or a valid Javascript Date object
        expiredInterval: 5 * 60 * 1000, // every 5 minutes the process will clean-up the expired cache
        // in some cases, you (or some other service) might add non-valid storage files to your
        // storage dir, i.e. Google Drive, make this true if you'd like to ignore these files and not throw an error
        forgiveParseErrors: false
    })
  }

  public storage() {
    return storage;
  }

  public async getItem(key: string | number) {
      return await storage.getItem(key);
  }

  public async setItem(key: string | number, value: any, options?: any[]) {
    return await storage.setItem(key, value, options); 
  }
}