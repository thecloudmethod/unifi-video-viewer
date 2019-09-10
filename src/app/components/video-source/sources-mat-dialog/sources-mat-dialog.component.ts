import { Component, Inject, OnInit} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { MatButtonToggleChange } from '@angular/material'
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { VideoSourceService } from '../../../services/video-source.service';

export interface addUnifiVideoServer {
  protocol?:  "http" | "https";
  host: string;
  port?: number;
  apikey: string;
  
}

export interface addStreamUrl {
  name: string;
  url: string
}

@Component({
  selector: 'sources-mat-dialog',
  templateUrl: './sources-mat-dialog.component.html',
  styleUrls: ['./sources-mat-dialog.component.css']
})
export class SourcesMatDialogComponent implements OnInit {

  source: "unifi" | "single" = "unifi";
  addUnifiForm: FormGroup;
  addSingleUrlForm: FormGroup;

  stream: any = {
    protocol: "https",
    host: null,
    port: 7443,
    apikey: null,
    name: null,
    url: null
  }

  constructor(
    public dialogRef: MatDialogRef<SourcesMatDialogComponent>,
    public videoSourceService: VideoSourceService,
    private _snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any) {}

    displayedColumns: string[] = ['name', 'host', 'apikey', 'options'];
    singleSourceDisplayedColumns: string[] = ['name', 'url', 'options'];
    nvrs: any[] = [];
    single_sources: any[] = [];

  ngOnInit() {
    this.getData();

    this.addUnifiForm = new FormGroup({
      'protocol': new FormControl(this.stream.protocol),
      'host': new FormControl(this.stream.host, Validators.required),
      'apikey': new FormControl(this.stream.apikey, Validators.required),
      'port': new FormControl(this.stream.port)
    });

    this.addSingleUrlForm = new FormGroup({
      'name': new FormControl(this.stream.name, Validators.required),
      'url': new FormControl(this.stream.url, Validators.required)
    });
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  getData() {
    this.videoSourceService.getNvr().subscribe((res:any) => {
      if(res.data) {
        this.nvrs = res.data;
      }
    });
    this.videoSourceService.getSingleSource().subscribe((res:any) => {
      if(res.data) {
        this.single_sources = res.data;
      }
    })
  }

  sourceChange(event: MatButtonToggleChange) {
    this.source = event.value;
  }

  public hasError = (controlName: string, errorName: string) =>{
    return this.addUnifiForm.controls[controlName].hasError(errorName);
  }

  public singleUrlHasError = (controlName: string, errorName: string) =>{
    return this.addSingleUrlForm.controls[controlName].hasError(errorName);
  }

  submitForm(values) {
  }

  formValid() {
    if(this.source=='unifi') {
      return !(this.addUnifiForm.status=="VALID");
    } else {
      return !(this.addSingleUrlForm.status=="VALID");
    }
  }

  formValues() {
    if(this.source=='unifi') {
      return this.addUnifiForm.value;
    } else {
      return this.addSingleUrlForm.value;
    }
  }

  validateSource() {
    if(this.source=='unifi') {
      this.videoSourceService.validateNvr(this.formValues()).subscribe(
        (res:any) => {
          if(res.data[0].isLoggedIn) {
            this.openSnackBar('NVR successfully added', 'Info');
            this.getData();
          } else {
            this.openSnackBar('ApiKey Invalid', 'Error');
          }
        }, 
        err => {
          this.openSnackBar(err.error.error, 'Error');
        })
    } else {
      this.videoSourceService.addSingleSource(this.formValues()).subscribe(
        (res:any) => {
          
          this.openSnackBar(this.formValues().name + ' successfully added', 'Info');
          this.getData();
        }, 
        err => {
          this.openSnackBar(err.error.error, 'Error');
        })
    }
  }

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }

  remove(element) {
    if(this.source=='unifi') {
      this.videoSourceService.deleteNvr(element._id).subscribe(res => {
        this.openSnackBar(element.name + ' successfully deleted', 'Info');
        this.getData();
      });
    } else {
      this.videoSourceService.deleteSingleSource(element._id).subscribe(res => {
        this.openSnackBar(element.name + ' successfully deleted', 'Info');
        this.getData();
      });
    }
  }

}
