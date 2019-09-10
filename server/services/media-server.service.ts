import { Injectable, OnModuleInit, OnApplicationBootstrap, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
const NodeMediaServer = require('node-media-server');

// Services
import { FfmpegService } from './ffmpeg.service';
import { HttpService } from '@nestjs/common';
import { WebsocketService } from '../services/websocket.service';

// Interfaces
import { Nvr } from '../interfaces/nvr.interface';

@Injectable()
export class MediaServerService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {

    config: any = {
        rtmp: {
            port: 1935,
            chunk_size: 60000,
            gop_cache: false,
            ping: 30,
            ping_timeout: 60
          },
          http: {
            port: 8000,
            mediaroot: './media',
            webroot: './www',
            allow_origin: '*'
          },
          /*
          https: {
            port: 8443,
            key: './privatekey.pem',
            cert: './certificate.pem',
          },
          */
          auth: {
            api: true,
            api_user: 'admin',
            api_pass: 'admin',
            play: false,
            publish: false,
            secret: 'nodemedia2017privatekey'
          },
    }

    nms = new NodeMediaServer(this.config)

    constructor(
        @Inject(forwardRef(() => FfmpegService))
        private ffmpegService: FfmpegService,
        private websocketService: WebsocketService
    ) {
    }

    onApplicationBootstrap() {


        this.nms.run();
        /*
        this.nms.on('preConnect', (id, args) => {
        console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
        // let session = this.nms.getSession(id);
        // session.reject();
        });

        this.nms.on('postConnect', (id, args) => {
        console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
        });

        this.nms.on('doneConnect', (id, args) => {
        console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
        });

        this.nms.on('prePublish', (id, StreamPath, args) => {
        console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        // let session = this.nms.getSession(id);
        // session.reject();
        });
        */
        this.nms.on('postPublish', (id, StreamPath, args) => {
           let streamPathArr =  StreamPath.split("/");
            let streamName =  streamPathArr[streamPathArr.length-1];
            for(let stream of this.ffmpegService.streams) {
                if(stream.streamName == streamName) {
                    stream.init$ = true;
                    this.websocketService.websocketRelaySubject$.next({ channel: 'refresh_stream_'+stream.streamName, message: true });
                }
            }

            for(let stream of this.ffmpegService.fullScreenStream) {
                if(stream.streamName == streamName) {
                    stream.init$ = true;
                    this.websocketService.websocketRelaySubject$.next({ channel: 'refresh_stream_'+stream.streamName, message: true });
                }
            }
          
        console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        });
        /* 
        this.nms.on('donePublish', (id, StreamPath, args) => {
        console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        });

        this.nms.on('prePlay', (id, StreamPath, args) => {
        console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        // let session = this.nms.getSession(id);
        // session.reject();
        });
        */
        this.nms.on('postPlay', (id, StreamPath, args) => {
            let streamPathArr =  StreamPath.split("/");
            let streamName =  streamPathArr[streamPathArr.length-1];
            this.ffmpegService.updateWatchers(streamName, 1);
        console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        });

        this.nms.on('donePlay', (id, StreamPath, args) => {
            let streamPathArr =  StreamPath.split("/");
            let streamName =  streamPathArr[streamPathArr.length-1];
            this.ffmpegService.updateWatchers(streamName, -1);
        console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        });
       

    }

    onModuleInit() {

    }

    onModuleDestroy() {
        delete this.nms
    }

}