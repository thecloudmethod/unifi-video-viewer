import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatTableDataSource } from '@angular/material'
import { MatSnackBar } from '@angular/material/snack-bar';

import { VideoSourceService } from '../../../services/video-source.service';

import { Live } from '../../../interfaces';

export interface liveInject {
  live: Live
}

@Component({
  selector: 'feed-select-bottom-sheet',
  templateUrl: './feed-select-bottom-sheet.component.html',
  styleUrls: ['./feed-select-bottom-sheet.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedSelectBottomSheetComponent implements OnInit {
  
  displayedColumns: string[] = ['thubnail', 'name', 'select'];
  dataSource: any;

  constructor(
    public _bottomSheetRef: MatBottomSheetRef<FeedSelectBottomSheetComponent>,
    public videoSourceService: VideoSourceService,
    private _snackBar: MatSnackBar,
    private ref: ChangeDetectorRef,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: liveInject
    ) {}


  ngOnInit() {
    this.videoSourceService.getFeeds().subscribe((res: any) => {
      this.dataSource = new MatTableDataSource(res.data);
      this.ref.markForCheck();
    })

  }

  selectFeed(event: MouseEvent, feed): void {
    this._bottomSheetRef.dismiss(feed);
    event.preventDefault();
  }

  removeFeed(event: MouseEvent): void {
    this.videoSourceService.deleteLive(this.data.live.position.toString(10))
    this.openSnackBar('Feed removed.', 'Info')
    this._bottomSheetRef.dismiss();
    event.preventDefault();
  }

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  isSelected(option: any): boolean {
    if(this.data.live.feedUrl) {
      if(option.type == 'unifi') {
        return this.data.live.feedUrl.includes(option._id);
      } else {
        return this.data.live.feedUrl == option.url;  
      }
      
    } else {
      return false;
    }
    
  }

}
