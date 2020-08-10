import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, AfterViewInit, AfterContentChecked, NgZone, OnDestroy, ViewChild, ElementRef, Directive } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

// Animations
import { trigger, state, style, animate, transition } from '@angular/animations'

// Services
import { AngularSocketIoUniversalService } from '../../services/angular-socket-io-universal.service';
import { VideoSourceService } from '../../services/video-source.service';

// Interfaces
import { Live } from '../../interfaces'
import { error } from 'selenium-webdriver';

declare var flvjs

@Component({
  selector: 'index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.css'],
  animations: [
    trigger('fadeInOut', [
      state('fullscreen', style({
        opacity: 100
      })),
      state('hidden', style({
        opacity: 0
      })),
      transition('* => hidden', [
        animate('1s')
      ]),
      transition('* => fullscreen', [
        animate('0.5s')
      ]),
    ]),
    trigger('displayNone', [
      state('fullscreen', style({
        display: 'block'
      })),
      state('hidden', style({
        display: 'none'
      })),
      transition('* => hidden', [
        animate('1s')
      ]),
      transition('* => fullscreen', [
        animate('0.1s')
      ]),
    ]),
  ]
})
export class IndexComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('videoElement',{ static: false }) video: ElementRef;
  @ViewChild('videoElement2',{ static: false }) video2: ElementRef;
  public isBrowser: boolean = isPlatformBrowser(this.platformId);
  flvPlayer: any;
  flvPlayer2: any;
  init: boolean = false;
  init2: boolean = false;
  


  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private io: AngularSocketIoUniversalService,
    public videoSourceService: VideoSourceService,
    private _snackBar: MatSnackBar,
    public zone: NgZone
  ) { }

  ngOnInit() {
  
    this.io.connect(this.document.location.protocol +'//'+ this.document.location.hostname+'/', this.isBrowser)
    if(this.isBrowser) {
      this.io.onMessage('refresh_stream_0').subscribe(events => {
        if(events) {
          this.InitStream1();
        }
      })

      this.io.onMessage('refresh_stream_1').subscribe(events => {
        if(events) {
          this.InitStream2();
        }
      })

      this.io.onMessage('err').subscribe(err => {
        console.log(err)
        if(err.data.component == 'ffmpeg') {
          this._snackBar.open('Failure initiation Stream:' + err.data.stream, 'Error', {
            duration: 10000,
          });
        }
      })

    }
  
  }

  

  syncStream() {

    setTimeout(() => {
      if(this.init && this.flvPlayer.currentTime > 10) {
        let lag = this.flvPlayer.buffered.end(0) - this.flvPlayer.currentTime;
        if(lag > 1) {
          this.video.nativeElement.playbackRate = 1.25;
        } else if(lag > 4) {
          this.video.nativeElement.playbackRate = 1.5;
        } else if(lag > 10) {
          console.log('Video 1 Lag', lag )
          this.video.nativeElement.playbackRate = 2;  
        } else {
          this.video.nativeElement.playbackRate = 1.0;  
        }
      }

      if(this.init2 && this.flvPlayer2.currentTime > 10) {
        let lag = this.flvPlayer2.buffered.end(0) - this.flvPlayer2.currentTime;
        if(lag > 1) {
          this.video2.nativeElement.playbackRate = 1.25;
        } else if(lag > 4) {
          this.video2.nativeElement.playbackRate = 1.5;
        } else if(lag > 10) {
          console.log('Video 2 Lag', lag )
          this.video2.nativeElement.playbackRate = 2;  
        } else {
          this.video2.nativeElement.playbackRate = 1.0;  
        } 
      }
      
      this.syncStream();
    }, 1000)
  }

  playerStatus() {
    setTimeout(() => {
      console.log('[Player 1]', {
        currentTime: this.flvPlayer.currentTime,
        buffered: { start: this.flvPlayer.buffered.start(0), end:this.flvPlayer.buffered.end(0) },
        mediaInfo: this.flvPlayer.mediaInfo,
        statisticsInfo: this.flvPlayer.mediaInfo
      })

      console.log('[Player 2]', {
        currentTime: this.flvPlayer2.currentTime,
        buffered: { start: this.flvPlayer2.buffered.start(0), end:this.flvPlayer2.buffered.end(0) },
        mediaInfo: this.flvPlayer2.mediaInfo,
        statisticsInfo: this.flvPlayer2.mediaInfo
      })

      
      this.playerStatus();
    },5*1000)  
  }

  ngAfterViewInit() {
    if(this.isBrowser) {
      this.zone.runOutsideAngular(()=>{
        if (flvjs.isSupported()) {
          this.video.nativeElement.muted = true;
          this.video2.nativeElement.muted = true;
          this.InitStream1();
          this.InitStream2();
        }   
      })
    }
  }

  

  InitStream1() {
    if(this.isBrowser) {
      this.zone.runOutsideAngular(()=>{
        if (flvjs.isSupported()) {

          if(!this.init) {
            this.flvPlayer = flvjs.createPlayer({
              type: 'flv',
              isLive: true,
              url: 'ws://'+this.document.location.hostname+':8000/live/0.flv'
            },
            {
              enableWorker: true,
              enableStashBuffer: false,
              stashInitialSize: 128,
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 2 * 60,
              autoCleanupMinBackwardDuration: 1 * 60

            });
            this.flvPlayer.attachMediaElement(this.video.nativeElement);
            this.init = true;
          } else {
            this.flvPlayer.unload();  
          }
          
          this.flvPlayer.load();
          this.video.nativeElement.play();

          
          this.syncStream();
          
          //this.playerStatus();
        }   
      })
    }
  }

  InitStream2() {
    if(this.isBrowser) {
      this.zone.runOutsideAngular(()=>{
        if (flvjs.isSupported()) {

          if(!this.init2) {
            this.flvPlayer2 = flvjs.createPlayer({
              type: 'flv',
              isLive: true,
              url: 'ws://'+this.document.location.hostname+':8000/live/1.flv'
            },
            {
              enableWorker: true,
              enableStashBuffer: false,
              stashInitialSize: 128,
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 2 * 60,
              autoCleanupMinBackwardDuration: 1 * 60
            });
            this.flvPlayer2.attachMediaElement(this.video2.nativeElement);
            this.init2 = true;
          } else {
            this.flvPlayer2.unload();  
          }
          
          this.flvPlayer2.load();
          this.video2.nativeElement.play();
        }   
      })
    }  
  }


  ngOnDestroy() {
    if(this.isBrowser) { 
      this.video.nativeElement.pause();
      this.video2.nativeElement.pause();
    }
    // delete this.videoElement;
    // delete this.flvPlayer;
  }
    

}
