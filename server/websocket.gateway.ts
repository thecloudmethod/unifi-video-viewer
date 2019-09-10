import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';

// Services
import { WebsocketService, WebsocketRelay } from './services/websocket.service'

@WebSocketGateway()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {

    constructor(private websocketService: WebsocketService) {

    }

    @WebSocketServer() server;
    watchers: number = 0;

    afterInit() {
        this.websocketService.websocketRelay$.subscribe((emit: WebsocketRelay) => {
            this.handleEmit(emit);
        })
    }

    async handleConnection(){

        // A client has connected
        this.watchers++;

        // Notify connected clients of current users
        this.server.emit('watchers', this.watchers);

    }

    async handleDisconnect(){

        // A client has disconnected
        this.watchers--;

        // Notify connected clients of current users
        this.server.emit('watchers', this.watchers);

    }

    async handleEmit(emit: WebsocketRelay){

        // Notify connected clients of message
        this.server.emit(emit.channel, emit.message);

    }

    @SubscribeMessage('info')
    async onInfo(client, message){
        client.broadcast.emit('info', message);
    }

}