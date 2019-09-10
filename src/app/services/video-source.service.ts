import { Injectable, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, share, takeLast } from 'rxjs/operators';
import { ReplaySubject, Observable, BehaviorSubject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

// Interfaces
import { UnifiVideoServer, StreamUrl, Settings, Live } from '../interfaces';


@Injectable()
export class VideoSourceService implements OnInit {

  public settingsSubject$: ReplaySubject<Settings> = new ReplaySubject();
  public settings$: Observable<Settings> = this.settingsSubject$.asObservable();
  public liveSubject$: ReplaySubject<Live[]> = new ReplaySubject();
  public live$: Observable<Live[]> = this.liveSubject$.asObservable();

  constructor(
    private http: HttpClient,
    private _snackBar: MatSnackBar
  ) {
    this.getSettings();
    this.getLive(); 
  }

  ngOnInit() {
    
  }

  getSpeakers() {
    return this.http.get<any[]>(environment.apiUrl+'/api/speakers');
  }

  validateNvr(body: UnifiVideoServer) {
    return this.http.post(environment.apiUrl+'/api/nvr',  body);
  }

  getNvr() {
    return this.http.get(environment.apiUrl+'/api/nvr').pipe(share());
  }

  getFeeds() {
    return this.http.get(environment.apiUrl+'/api/feeds').pipe(share());
  }

  deleteNvr(id: string) {
    return this.http.delete(environment.apiUrl+'/api/nvr/'+id);
  }

  addSingleSource(body: StreamUrl) {
    return this.http.post(environment.apiUrl+'/api/single-source-stream',  body);
  }

  getSingleSource() {
    return this.http.get(environment.apiUrl+'/api/single-source-stream').pipe(share());
  }

  deleteSingleSource(id: string) {
    return this.http.delete(environment.apiUrl+'/api/single-source-stream/'+id);
  }

  addSettings(body: Settings) {
    this.settingsSubject$.next(body)
    return this.http.post(environment.apiUrl+'/api/settings',  body);
  }

  getSettings() {
    this.http.get(environment.apiUrl+'/api/settings').subscribe((settings: any) => {
      this.settingsSubject$.next(settings.data)
    });
      
  }

  getLive() {
    this.http.get(environment.apiUrl+'/api/live').subscribe((live: any) => {
      this.liveSubject$.next(live.data)
    });
  }

  deleteLive(id: string) {
    this.http.delete(environment.apiUrl+'/api/live/'+id).subscribe((live: any) => {
      this.liveSubject$.next(live.data)
    });
  }

  addLive(body: Live) {
    return this.http.post(environment.apiUrl+'/api/live',  body).subscribe((live: any) => {
      this.getLive();
      this.openSnackBar('Feed successfully Added', 'Info');
    },
    err => {
      this.openSnackBar('Wthere was an error adding the feed', 'Error');
    });
  }

  fullScreen(body: Live) {
    return this.http.post(environment.apiUrl+'/api/full_screen',  body)
  }

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }
}