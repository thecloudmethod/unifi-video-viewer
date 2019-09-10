import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  public isBrowser: boolean = isPlatformBrowser(this.platformId);

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}
}