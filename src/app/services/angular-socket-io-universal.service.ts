import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import * as io from 'socket.io-client';

const socketio = io;

@Injectable({
  providedIn: 'root'
})
export class AngularSocketIoUniversalService {
  private isBrowser: boolean;
  public server_url: string;
	private socket;
	


	constructor() { }
	
	/**
	 * Connect to socket.io server and infrom the service if not a browser to make (SSR) Angular Universal Compatible
	 * @param server_url - the url of the socket.io endpoint
	 * @param [isBroswer] - Due do inject(PLATFORM_ID) initializing after the service init we must send the value at component runtime.
	 */
	public connect(server_url: string, isBroswer = true): void {
		this.isBrowser = isBroswer;

    if(this.isBrowser) {
			this.server_url = server_url;
			this.socket = socketio(this.server_url);

			this.socket.on('*', event => {
				//console.log(event)
			})
    }
  }
	

  /**
	 * Sends event though socket.io
	 * @param event - the name of the event to send though the socket.io namespace.
	 * @param message - the object to be sent though socket.io 
	 */
	public send(event: string, message: any): void {
		if(this.socket && this.isBrowser) {
			this.socket.emit(event, message);
		}
  }


  
	/**
	 * Determines whether message on
	 * @param event - the name of the event to send though the socket.io namespace. 
	 * @returns Observable<any> of each subscribed event.
	 */
	public onMessage(event: string): Observable<any> {
		if(this.isBrowser) {
			return new Observable<any>(observer => {
				this.socket.on(event, (data: any) => observer.next(data));
			});
		} else {
			return new Observable<any>(observer => {
				observer.next({});
			});
		}
  }
}
