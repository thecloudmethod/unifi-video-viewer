import { Injectable, Inject, OnInit, Injector, ComponentRef } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, PortalInjector } from '@angular/cdk/portal';

import { FullScreenStreamComponent } from './full-screen-stream.component';

import { FullScreenStreamRef } from './full-screen-stream-ref';
import { FULL_SCREEN_STREAM_DIALOG_DATA } from './full-screen-stream.tokens';

import { Live } from '../../interfaces';


interface FullScreenStreamConfig {
  panelClass?: string;
  hasBackdrop?: boolean;
  backdropClass?: string;
  live?: Live;
}

const DEFAULT_CONFIG: FullScreenStreamConfig = {
  hasBackdrop: true,
  backdropClass: 'dark-backdrop',
  panelClass: 'tm-file-preview-dialog-panel',
  live: null
}

@Injectable()
export class FullScreenStreamService {

  constructor(
    private injector: Injector,
    private overlay: Overlay) { }

  open(config: FullScreenStreamConfig = {}) {
    // Override default configuration
    const dialogConfig = { ...DEFAULT_CONFIG, ...config };

    // Returns an OverlayRef which is a PortalHost
    const overlayRef = this.createOverlay(dialogConfig);

    // Instantiate remote control
    const dialogRef = new FullScreenStreamRef(overlayRef);

    const overlayComponent = this.attachDialogContainer(overlayRef, dialogConfig, dialogRef);

    overlayRef.backdropClick().subscribe(_ => dialogRef.close());

    return dialogRef;
  }

  private createOverlay(config: FullScreenStreamConfig) {
    const overlayConfig = this.getOverlayConfig(config);
    return this.overlay.create(overlayConfig);
  }

  private attachDialogContainer(overlayRef: OverlayRef, config: FullScreenStreamConfig, dialogRef: FullScreenStreamRef) {
    const injector = this.createInjector(config, dialogRef);

    const containerPortal = new ComponentPortal(FullScreenStreamComponent, null, injector);
    const containerRef: ComponentRef<FullScreenStreamComponent> = overlayRef.attach(containerPortal);

    return containerRef.instance;
  }

  private createInjector(config: FullScreenStreamConfig, dialogRef: FullScreenStreamRef): PortalInjector {
    const injectionTokens = new WeakMap();

    injectionTokens.set(FullScreenStreamRef, dialogRef);
    injectionTokens.set(FULL_SCREEN_STREAM_DIALOG_DATA, config.live);

    return new PortalInjector(this.injector, injectionTokens);
  }

  private getOverlayConfig(config: FullScreenStreamConfig): OverlayConfig {
    const positionStrategy = this.overlay.position()
      .global()
      .centerHorizontally()
      .centerVertically();

    const overlayConfig = new OverlayConfig({
      hasBackdrop: config.hasBackdrop,
      backdropClass: config.backdropClass,
      panelClass: config.panelClass,
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy
    });

    return overlayConfig;
  }
}