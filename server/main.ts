process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

declare const module: any;

import { NestFactory } from '@nestjs/core';
import { ApplicationModule } from './app.module';

import { environment } from '../src/environments/environment';

const env = { environment, ...{ environment: { httpPort: process.env.PORT }} }

async function bootstrap() {
  const app = await NestFactory.create(ApplicationModule);
  app.enableCors({
    methods: '*',
    maxAge: 3600,
  });
  await app.listen(env.environment.httpPort);

  console.log('Server Running On Port:'+  env.environment.httpPort)
  
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap().catch(err => console.error(err));