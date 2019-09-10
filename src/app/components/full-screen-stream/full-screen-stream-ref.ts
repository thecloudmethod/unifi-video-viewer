import { OverlayRef } from '@angular/cdk/overlay';

export class FullScreenStreamRef {

  constructor(private overlayRef: OverlayRef) { }

  close(): void {
    this.overlayRef.dispose();
  }
}
