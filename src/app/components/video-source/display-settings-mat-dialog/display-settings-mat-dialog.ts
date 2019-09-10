import { Component, Inject, OnInit} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { VideoSourceService } from '../../../services/video-source.service';

@Component({
  selector: 'display-settings-mat-dialog',
  templateUrl: './display-settings-mat-dialog.component.html',
  styleUrls: ['./display-settings-mat-dialog.component.css']
})
export class DisplaySettingsMatDialogComponent implements OnInit {

  displaySettings: FormGroup;

  settings: any = {
    fpr: '4',
    width: '1920',
    hwaccel: true,
    hwaprov: 'nvidia'
  }

  constructor(
    public dialogRef: MatDialogRef<DisplaySettingsMatDialogComponent>,
    public videoSourceService: VideoSourceService,
    private _snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any) {}


  ngOnInit() {

    this.displaySettings = new FormGroup({
      "fpr": new FormControl(this.settings.fpr),
      "tpw": new FormControl(this.settings.width, Validators.required),
      "hwaccel": new FormControl(this.settings.hwaccel),
      "hwaprov": new FormControl(this.settings.hwaprov),
    });

    this.videoSourceService.settings$.subscribe(settings => {
      this.displaySettings.setValue(settings);
      this.settings = settings;
    })
  }

  onNoClick(): void {
    this.dialogRef.close();
  }


  public hasError = (controlName: string, errorName: string) =>{
    return this.displaySettings.controls[controlName].hasError(errorName);
  }


  submitForm(values) {
  }

  formValid() {
    return !(this.displaySettings.status=="VALID");
  }

  formValues() {
    return this.displaySettings.value;
  }

  validateSource() {
    this.videoSourceService.addSettings(this.formValues()).subscribe(
        (res:any) => {
          
          this.openSnackBar('Settings Updated', 'Info');
        }, 
        err => {
          this.openSnackBar(err.error.error, 'Error');
        })
  }

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }

}
