import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { TransferHttpCacheModule } from '@nguniversal/common';
import { DragulaModule } from 'ng2-dragula';
import { AppComponent } from './app.component';
import { SharedModule } from './modules/shared/shared.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularMaterialModule } from './modules/angular-material';
import { IndexComponent } from './components/index/index.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';

// Components
import { VideoSourceComponent } from './components/video-source/video-source.component';
import { SourcesMatDialogComponent } from './components/video-source/sources-mat-dialog/sources-mat-dialog.component';
import { DisplaySettingsMatDialogComponent } from './components/video-source/display-settings-mat-dialog/display-settings-mat-dialog';
import { GridOverlayComponent } from './components/grid-overlay/gid-overlay.component';
import { FeedSelectComponent } from './components/feed-select/feed-select.component';
import { FeedSelectBottomSheetComponent } from './components/feed-select/feed-select-bottom-sheet/feed-select-bottom-sheet.component';
import { FullScreenStreamComponent } from './components/full-screen-stream/full-screen-stream.component';

// Services
import { WindowService } from './services/window/window.service';
import { VideoSourceService } from './services/video-source.service';
import { AngularSocketIoUniversalService } from './services/angular-socket-io-universal.service'
import { FullScreenStreamService } from './components/full-screen-stream/full-screen-stream.service';

// For AoT compilation:
export function getWindow() {
  return window;
}

@NgModule({
  entryComponents: [VideoSourceComponent, SourcesMatDialogComponent, DisplaySettingsMatDialogComponent, FeedSelectBottomSheetComponent, FullScreenStreamComponent],
  declarations: [AppComponent, IndexComponent, VideoSourceComponent, SourcesMatDialogComponent, DisplaySettingsMatDialogComponent, GridOverlayComponent, FeedSelectComponent, FeedSelectBottomSheetComponent, FullScreenStreamComponent],
  imports: [
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    DragulaModule.forRoot(),
    OverlayModule,
    // Add .withServerTransition() to support Universal rendering.
    // The application ID can be any identifier which is unique on
    // the page.
    AngularMaterialModule,
    BrowserAnimationsModule,
    BrowserModule.withServerTransition({ appId: 'my-app' }),
    TransferHttpCacheModule,
    RouterModule.forRoot([
      { path: '', component: IndexComponent, pathMatch: 'full' },
    ]),
    SharedModule,
  ],
  providers: [
    VideoSourceService,
    AngularSocketIoUniversalService,
    FullScreenStreamService,
    {
      provide: WindowService,
      useFactory: getWindow,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
