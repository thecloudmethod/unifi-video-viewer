import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';

// Services
import { AngularSocketIoUniversalService } from '../../services/angular-socket-io-universal.service';
import { VideoSourceService } from '../../services/video-source.service';
import { FullScreenStreamService } from '../full-screen-stream/full-screen-stream.service';

import { FullScreenStreamRef } from '../full-screen-stream/full-screen-stream-ref';

// Interfaces
import { Settings, Live } from '../../interfaces';

@Component({
  selector: 'grid-overlay',
  templateUrl: './grid-overlay.component.html',
  styleUrls: ['./grid-overlay.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridOverlayComponent implements OnInit {

  public isBrowser: boolean = isPlatformBrowser(this.platformId);

  settings: Settings = {
    fpr: '4',
    tpw: '1920',
    hwaccel: true,
    hwaprov: 'nvidia'
  }; 
  feeds: Live[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private fullScreenDialog: FullScreenStreamService,
    public videoSourceService: VideoSourceService,
    private ref: ChangeDetectorRef,
    private io: AngularSocketIoUniversalService
    
  ) { }


  ngOnInit() {
    combineLatest(this.videoSourceService.settings$, this.videoSourceService.live$).subscribe(([settings, feeds]) => {
      this.settings = settings;
      this.feeds = feeds;
      this.ref.markForCheck();
    })

    this.io.connect(this.document.location.protocol +'//'+ this.document.location.hostname+'/', this.isBrowser)

    this.io.onMessage('refresh').subscribe(events => {
      if(events) {
        this.videoSourceService.getLive(); 
      }
    }) 
  }

  getFeeds() {
    //this.videoSourceService.getSettings().subscribe((settings: addSettings) => this.settings = settings);
  }

  getColumnCount() {
    return Number(this.settings.fpr);
  }

  initFullScreen(feed: Live) {
    if(feed.feedUrl) {
      let dialogRef: FullScreenStreamRef = this.fullScreenDialog.open({
        live: feed
      });
    }
    
  }

}
