import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';

export interface WebsocketRelay {
    channel: string,
    message: any
}

@Injectable()
export class WebsocketService {
    public websocketRelaySubject$: ReplaySubject<WebsocketRelay> = new ReplaySubject();
    public websocketRelay$: Observable<WebsocketRelay> = this.websocketRelaySubject$.asObservable();
}