import { Module, HttpModule } from '@nestjs/common';
import { AngularUniversalModule, applyDomino } from '@nestjs/ng-universal';
import { join } from 'path';
import { AppController } from './app.controller';



//Services
import { MediaServerService } from './services/media-server.service';
import { UnifiNvrApiService } from './services/unifi-nvr-api.service';
import { StorageService } from './services/storage.service';
import { FfmpegService } from './services/ffmpeg.service';
import { WebsocketService } from './services/websocket.service';
import { WebsocketGateway } from './websocket.gateway';

const BUNDLE_DIR = join(process.cwd(), 'server');
const BROWSER_DIR = join(process.cwd(), 'dist/browser');
applyDomino(global, join(BROWSER_DIR, 'index.html'));

@Module({
  imports: [
    AngularUniversalModule.forRoot({
      viewsPath: BROWSER_DIR,
      bundle: require('../server/main'),
      liveReload: true,
    }),
    HttpModule
  ],
  controllers: [AppController],
  providers: [
    MediaServerService,
    UnifiNvrApiService,
    StorageService,
    FfmpegService,
    WebsocketService,
    WebsocketGateway
  ],
})
export class ApplicationModule {}
