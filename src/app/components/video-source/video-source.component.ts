import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, OnDestroy, } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { VideoSourceService } from '../../services/video-source.service';
import { Observable, Subscription } from 'rxjs';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';

// Animations
import { trigger, state, style, animate, transition } from '@angular/animations'

// Dialog Component
import { SourcesMatDialogComponent } from './sources-mat-dialog/sources-mat-dialog.component';
import { DisplaySettingsMatDialogComponent } from './display-settings-mat-dialog/display-settings-mat-dialog';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'video-source',
  templateUrl: './video-source.component.html',
  styleUrls: ['./video-source.component.css'],
  animations: [
    trigger('fadeInOut', [
      state('mouseover', style({
        opacity: 100
      })),
      state('mouseleave', style({
        opacity: 0
      })),
      transition('* => mouseleave', [
        animate('1s')
      ]),
      transition('* => mouseover', [
        animate('0.5s')
      ]),
    ]),
  ]
})
export class VideoSourceComponent implements OnInit, OnDestroy {
  private _subscriptions: Subscription =  new Subscription();
  public actionBarStatus: boolean = false;
  public isBrowser: boolean = isPlatformBrowser(this.platformId);
  body: any;
  fullscreen: boolean = false;

  constructor(
    private _http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private videoSourceService: VideoSourceService,
    public dialog: MatDialog
  ) {
 
  }

  ngOnInit() { 

    if(this.isBrowser) {

      this.body = this.document.getElementById("body"); 

      /* When the openFullscreen() function is executed, open the video in fullscreen.
      Note that we must include prefixes for different browsers, as they don't support the requestFullscreen method yet */
      //this.doc.getElementById("openFullscreen").click(); 

    }

  }

  openFullscreen() {
    if(!this.fullscreen) {
      if (this.body.requestFullscreen) {
        this.body.requestFullscreen();
      } else if (this.body.mozRequestFullScreen) { /* Firefox */
        this.body.mozRequestFullScreen();
      } else if (this.body.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        this.body.webkitRequestFullscreen();
      } else if (this.body.msRequestFullscreen) { /* IE/Edge */
        this.body.msRequestFullscreen();
      }
      this.fullscreen = true;
    } else {
      this.document.exitFullscreen();
      this.fullscreen = false;
    }
    
  }

  changeActionBarStatus(status?: boolean) {
    if(status) {
      this.actionBarStatus = status;
    } else {
      this.actionBarStatus = !this.actionBarStatus;
    }
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(SourcesMatDialogComponent, {
      data: {title: 'Manage Sources'},
      panelClass: ['col-md-6', 'col-xs-10']
    });

    dialogRef.afterClosed().subscribe(result => {

    });
  }

  resetStreams(): void {
    this._subscriptions.add(
    this._http.get(this.document.location.protocol +'//'+ this.document.location.hostname+'/api/reset').subscribe(res => {})
    )
  }

  openSettingsDialog(): void {
    const dialogRef = this.dialog.open(DisplaySettingsMatDialogComponent, {
      data: {title: 'Settings'},
      panelClass: ['col-md-6', 'col-xs-10']
    });

    dialogRef.afterClosed().subscribe(result => {

    });
  }

  ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

}
