import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID,  Inject, NgZone, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

import { FullScreenStreamRef } from './full-screen-stream-ref';
import { FULL_SCREEN_STREAM_DIALOG_DATA } from './full-screen-stream.tokens';

// Services
import { AngularSocketIoUniversalService } from '../../services/angular-socket-io-universal.service';
import { VideoSourceService } from '../../services/video-source.service';


// Interfaces
import { Live } from '../../interfaces'

declare var flvjs

@Component({
  selector: 'full-screen-stream',
  templateUrl: './full-screen-stream.component.html',
  styleUrls: ['./full-screen-stream.component.css']
})
export class FullScreenStreamComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('fullScreenStream',{ static: false }) fullScreenStream: ElementRef;
    public isBrowser: boolean = isPlatformBrowser(this.platformId);
    fullScreenFlvPlayer: any;
    fullScreenInit: boolean = false;
    fullScreenClicked: boolean = false;
    fullScreenFeed: Live;

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private io: AngularSocketIoUniversalService,
        public videoSourceService: VideoSourceService,
        public zone: NgZone,
        public dialogRef: FullScreenStreamRef,
        private _snackBar: MatSnackBar,
        @Inject(FULL_SCREEN_STREAM_DIALOG_DATA) public live: any) { }

    ngOnInit() {
        this.io.connect(environment.apiUrl+'/', this.isBrowser)
    }

    ngAfterViewInit() {
      if(this.isBrowser) {
        this.zone.runOutsideAngular(()=>{
          if (flvjs.isSupported()) {
          this.initFullScreen();
          }   
        })
      }
    }

    initFullScreen() {
        this.fullScreenFeed = this.live;
        let streamPathArr =  this.live.fullResFeedUrl.split("/");
        let streamName =  streamPathArr[streamPathArr.length-1];
        this.fullScreenClicked = true;
    
        if(this.fullScreenInit) {
          this.fullScreenFlvPlayer.unload();
          this.fullScreenFlvPlayer.destroy(); 
        }
    
        this.videoSourceService.fullScreen(this.live).subscribe((res: any) => {
            if(res.init$) {
                this.fullScreenInit = true;
                this.fullScreenFlvPlayer.load();
                this.fullScreenStream.nativeElement.play();    
            }
        });
    
        this.io.onMessage('refresh_stream_'+streamName).subscribe(events => {
          if(events) {
            this.fullScreenInit = true;
            this.fullScreenFlvPlayer.load();
            this.fullScreenStream.nativeElement.play();

            this.syncStream()
          }
        })

        this.io.onMessage('err').subscribe(err => {
          console.log(err)
          if(err.data.component == 'ffmpeg' && err.data.stream == streamName) {
            this._snackBar.open('Failure initiation Stream:' + err.data.stream, 'Error', {
              duration: 10000,
            });

            this.unloadFullScreen();
          }
        })
        
        if(this.isBrowser) {
          this.zone.runOutsideAngular(()=>{
            if (flvjs.isSupported()) {
      
              
      
              
              this.fullScreenFlvPlayer = flvjs.createPlayer({
                type: 'flv',
                isLive: true,
                url: 'ws://'+environment.hostName+':8000/live/'+streamName+'.flv'
              },
              {
                enableWorker: true,
                enableStashBuffer: false,
                stashInitialSize: 128,
                fixAudioTimestampGap: false,
              });
              this.fullScreenFlvPlayer.attachMediaElement(this.fullScreenStream.nativeElement);
              
              
            }   
          })
        }
        console.log(this.live)
      }

      syncStream() {

        setTimeout(() => {
          if(this.fullScreenInit && this.fullScreenFlvPlayer.currentTime > 1) {
            let lag = this.fullScreenFlvPlayer.buffered.end(0) - this.fullScreenFlvPlayer.currentTime;
            
            if(lag > 4) {
              this.fullScreenStream.nativeElement.playbackRate = 1.5;
            } else if(lag > 1) {
              //console.log('Video 1 Lag', lag )
              this.fullScreenStream.nativeElement.playbackRate = 1.25;  
            } else {
              this.fullScreenStream.nativeElement.playbackRate = 1.0;  
            }
          }

          
          this.syncStream();
        }, 1000)
      }

    unloadFullScreen() {
        this.dialogRef.close()    
    }

    ngOnDestroy() {
        this.fullScreenStream.nativeElement.pause();
        if(this.fullScreenFlvPlayer) {
            this.fullScreenFlvPlayer.unload();
            this.fullScreenFlvPlayer.destroy();
        }
      }
}
