import { Component, OnInit, Input } from '@angular/core';
import { VideoSourceService } from '../../services/video-source.service';
import { Observable } from 'rxjs';
import {MatBottomSheet, MatBottomSheetRef} from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';

// Animations
import { trigger, state, style, animate, transition } from '@angular/animations'

// Dialog Component
import { FeedSelectBottomSheetComponent } from './feed-select-bottom-sheet/feed-select-bottom-sheet.component'

// Interfaces
import { Live } from '../../interfaces';

@Component({
  selector: 'feed-select',
  templateUrl: './feed-select.component.html',
  styleUrls: ['./feed-select.component.css'],
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
export class FeedSelectComponent implements OnInit {
  @Input() live: Live;
  public editSourceStatus: boolean = false;

  feedSelectOpen: boolean = false;

  

  constructor(
    private videoSourceService: VideoSourceService,
    private _bottomSheet: MatBottomSheet,
    private _snackBar: MatSnackBar,
  ) {
 
  }

  ngOnInit() {

  }

  changeEditSourceStatus(status?: boolean) {
    if(status) {
      this.editSourceStatus = status;
    } else {
      this.editSourceStatus = !this.editSourceStatus;
    }
  }

  openFeedSelect(): void {
    this.feedSelectOpen = true;
    this._bottomSheet.open(FeedSelectBottomSheetComponent, {
      data: { live: this.live },
    });

    this._bottomSheet._openedBottomSheetRef.afterDismissed().subscribe(result => {
      if(result) {
        this.processSubmitFeed(result);
      }
      this.feedSelectOpen = false
    });
  }

  processSubmitFeed(selected) {
    let addLive: Live;

    if(selected.type =="unifi") {
      addLive = {
        position: this.live.position,
        feedUrl: selected.filteredChannels[selected.filteredChannels.length-1].rtmpUris[0],
        fullResFeedUrl: selected.filteredChannels[0].rtmpUris[0],
        type: selected.type,
        _id: selected._id,
        controllerHostId: selected.controllerHostId
      }
    } else {
      addLive = {
        position: this.live.position,
        feedUrl: selected.url,
        fullResFeedUrl: selected.url,
        type: selected.type
      }  
    }
    

    this.videoSourceService.addLive(addLive)

    
  }

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }

}
