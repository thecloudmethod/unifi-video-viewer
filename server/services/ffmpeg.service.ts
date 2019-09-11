import { Injectable, OnModuleInit, Inject, forwardRef, OnApplicationShutdown } from '@nestjs/common';
import { FfmpegCommand } from 'fluent-ffmpeg';
import { ReplaySubject, Observable, BehaviorSubject, forkJoin, asyncScheduler } from 'rxjs';
import { map, distinctUntilChanged, debounceTime, throttleTime } from 'rxjs/operators';

import * as ffmpeg from 'fluent-ffmpeg';

//Services
import { StorageService } from './storage.service';
import { WebsocketService } from './websocket.service';
import { UnifiNvrApiService } from './unifi-nvr-api.service';

// Interfaces
import { Nvr } from '../interfaces/nvr.interface';
import { LiveDto } from '../interfaces/live.dto';
import { SettingsDto } from '../interfaces/settings.dto';

export interface Streams {
    init$: boolean;
    streamName: string;
    mosaicCommand: string;
    rows: number;
    neededFeeds: number;
    startIndex: number;
    feeds: LiveDto[];
    ffmpeg: FfmpegCommand;
    feedsInputOptions?: string[];
    feedsOutputOptions?: string[];
    watchers?: number;
    initSIGKILL?: boolean;
}

export interface FullSceenStream {
    init$?: boolean;
    streamName?: string;
    ffmpeg?: FfmpegCommand;
    feed?: LiveDto;
    watchers?: number;
    initSIGKILL?: boolean;
}

@Injectable()
export class FfmpegService implements OnModuleInit, OnApplicationShutdown {
    public liveSubject$: ReplaySubject<LiveDto[]> = new ReplaySubject();
    public live$: Observable<LiveDto[]> = this.liveSubject$.asObservable();

    public errorBufferSubject$: ReplaySubject<any> = new ReplaySubject();
    public errorBuffer$: Observable<any> = this.errorBufferSubject$.asObservable();

    public throttleSubject$: ReplaySubject<any> = new ReplaySubject();
    public throttle$: Observable<any> = this.throttleSubject$.asObservable();

    settings:  SettingsDto;
    rows: number = 1;
    feedsPerRow: number = 4;
    live: LiveDto[] = [];
    feeds: LiveDto[] = [];
    disconnected_feeds: LiveDto[] = [];
    unifiFeeds: any[] = [];
    feedWidth: number = 480;
    feedHeight: number = 270;
    ptsOffest: number = 0;
    ptsOffestIncrement: number = .8;

    defaultInputOptions = [/*'-an',*/ '-rtmp_buffer 0', '-fflags nobuffer', '-copyts']
    inputOptions = []
    defaultOutputOptions = ['-b:v 200k','-bufsize 13K', '-maxrate 200k', '-vsync 0'];
    outputOptions = [];


    public streams: Streams[] = [];
    public streamsInit: boolean = false;
    streamsInitCount: number = 0;
    neededFeeds: number = 4;
    feedStatusInit: boolean = false;

    public fullScreenStream: FullSceenStream[] = [];

    constructor(
        private readonly storageService: StorageService,
        @Inject(forwardRef(() => UnifiNvrApiService))
        private readonly unifiNvrApiService: UnifiNvrApiService,
        private websocketService: WebsocketService
    ) {
    }

    onModuleInit() {
        setTimeout(async ()=>{
            let live = await this.storageService.storage().getItem("live");
            this.liveSubject$.next(live)
        },1000)

        this.live$.subscribe(async live => {
            this.live = live;
            this.disconnected_feeds = [];
            //this.buildTestFfmpeg();
            //this.loadFfmpeg()
            
            if(!this.feedStatusInit) {
                this.checkDisconnectedFeeds();
            }
            this.disconnected_feeds = await this.getDisconnectedFeeds();
            
            
            await this.compileFeeds();
            await this.initStreams();
            await this.assignFeeds();
            await this.execStreams();
           
        })

        this.errorBuffer$.pipe(
                throttleTime(60*1000, asyncScheduler, { leading: true, trailing: false }) // wait 30 seconds after the last event before emitting last event
            )
        .subscribe(ready=>{
            console.log('[triggers reload for stream:]', ready)
            this.triggerReload();
        });

        this.throttle$.pipe(
            throttleTime(30000, asyncScheduler, { leading: true, trailing: false })
        ).subscribe(go => {
            for(let stream of this.streams) {
                if(stream.init$ && stream.ffmpeg) {
                    stream.initSIGKILL = true;
                    stream.ffmpeg.kill('SIGKILL');
                    stream.init$ = false;
                    stream.feedsInputOptions = this.inputOptions;
                    stream.feedsOutputOptions = this.outputOptions;    
                }
            }
    
            setTimeout(async () => {
                let live = await this.storageService.storage().getItem("live");
                this.liveSubject$.next(live)
            }, 5000)
        })

        this.websocketService.websocketRelaySubject$.subscribe(data => {
            if(data.channel == 'err') {
                if(data.message.data.component == 'ffmpeg') {
                    let streams_copy = this.streams;
                    let matchingStream = streams_copy.filter(stream => stream.streamName == data.message.data.stream);
                    //console.log({ stream: data.message.data.stream, matchingStream: matchingStream})
                    if(matchingStream.length == 1 && !matchingStream[0].initSIGKILL) {
                        
                        console.log({ stream: data.message.data.stream, initSIGKILL: matchingStream[0].initSIGKILL, reload: true })
                        this.errorBufferSubject$.next(data.message.data.stream)
                    } 
                }
            }
        })
    }

    async getDisconnectedFeeds() {
        let unifiCameras = await this.getAllCameras();
        const previous_disconnected_feeds = this.disconnected_feeds
        let triggerReload: boolean = false;
            
        return unifiCameras.pipe(map(async res => {
            let unifi_video_copy = res;
            return unifi_video_copy.filter(unifi_feed => unifi_feed.state != "CONNECTED");
        })).toPromise()
    }

    async checkDisconnectedFeeds() {
        let unifiCameras = await this.getAllCameras();
        const previous_disconnected_feeds = this.disconnected_feeds
            
        unifiCameras.subscribe(async res => {
            this.unifiFeeds = res;
            let unifi_video_copy = res;
            let disconnected_unifi_feeds = unifi_video_copy.filter(unifi_feed => unifi_feed.state != "CONNECTED");
            this.disconnected_feeds = [];
            let triggerReload: boolean = false;
            
            if(previous_disconnected_feeds.length > 1 && disconnected_unifi_feeds.length < 1) {
                triggerReload = true;
            }

            if(disconnected_unifi_feeds.length > previous_disconnected_feeds.length) {
                triggerReload = true;    
            }


            if(disconnected_unifi_feeds.length > 0) {
                
                for(let live_feeds of this.live) {
                    let disconnected_unifi_feeds_copy = disconnected_unifi_feeds
                    let matching_disconnected_feed = disconnected_unifi_feeds_copy.filter(unifi_feed => live_feeds._id == unifi_feed._id);

                    if(matching_disconnected_feed.length == 1) {
                        this.disconnected_feeds.push(matching_disconnected_feed[0]);
                    }
                    
                }
            
            }
            
            previous_disconnected_feeds.forEach((feed, index) => {
                let unifi_video_copy = this.unifiFeeds;
                let matching_unifi_feed = unifi_video_copy.filter(unifi_feed => feed._id == unifi_feed._id);

                if(matching_unifi_feed.length == 1) {
                    if(matching_unifi_feed[0].state == "CONNECTED") {
                        triggerReload = true;
                    }
                }
            })

            if(this.disconnected_feeds.length > previous_disconnected_feeds.length) {
                triggerReload = true;
            }

            if(this.feedStatusInit) {
                if(triggerReload) {
                    this.triggerReload()
                }    
            } else {
                this.feedStatusInit = true;
            }

            setTimeout(() => {
                this.checkDisconnectedFeeds();
            }, 5*1000);

        })

        
    }

    async triggerReload() {
        this.throttleSubject$.next(true);
    }

    async getAllCameras(){
        let nvrs = await this.storageService.storage().getItem("nvrs");
        let nvrs$: Observable<any>[] = [];
        
        for(let nvr of nvrs) {
          nvrs$.push(this.unifiNvrApiService.getCameraList(nvr))
        }
    
        return forkJoin(...nvrs$).pipe(map(res => {
          let cameras: any [] = [];
          for(let nvr of res) {
            cameras = cameras.concat(nvr);
          }
        
          cameras.sort(function(a, b){
            if(a.name < b.name) { return -1; }
            if(a.name > b.name) { return 1; }
            return 0;
          })
    
          return cameras
        }));
      }

    async compileFeeds() {
        this.feeds = [];
        this.settings = await this.storageService.storage().getItem("settings");
        let inputCounter: number = 0;
        this.rows = Math.ceil((this.live[this.live.length-1].position+1)/Number(this.settings.fpr));
        this.neededFeeds = this.rows*Number(this.settings.fpr);
        this.feedWidth = parseInt(this.settings.tpw, 10)/parseInt(this.settings.fpr, 10);
        this.feedHeight = (this.feedWidth/16)*9;
            
        let i;
        for (i = 0; i < this.neededFeeds; i++) {
            let live_copy = this.live;
            let matchingFeed = live_copy.filter(feed => feed.position == i);

            if(matchingFeed.length > 0) {
                let disconnected_feeds = this.disconnected_feeds;
                let matching_unifi_feed = disconnected_feeds.filter(disconnected_feed => matchingFeed[0]._id == disconnected_feed._id);

                let state = "CONNECTED";

                if(matching_unifi_feed.length == 1) {
                    state = matching_unifi_feed[0].state
                }

                if(state == "CONNECTED") {
                    matchingFeed[0].inputIndex = inputCounter
                    this.feeds.push(matchingFeed[0]);
                    inputCounter++;
                } else {
                    this.feeds.push({
                        position: i,
                        feedUrl: null,
                        fullResFeedUrl: null,
                        type: null,
                        state: state
                    })    
                }
                
            } else {
                this.feeds.push({
                    position: i,
                    feedUrl: null,
                    fullResFeedUrl: null,
                    type: null,
                    state: "CONNECTED"
                })
            }
        }
    }

    async initStreams() {
        this.feedsPerRow = Number(this.settings.fpr);

        await this.compileSettings();

        this.streams.forEach(async stream => {
            
            if(stream.init$ && stream.ffmpeg) {
                await stream.ffmpeg.kill('SIGKILL');
                stream.init$ = false;

                stream.feedsInputOptions = this.inputOptions;
                stream.feedsOutputOptions = this.outputOptions;
            }
        })

        if(this.live.length > 0) {

            if(this.rows > 1) {
                this.streams = [
                    {
                        init$: false,
                        streamName: '0',
                        mosaicCommand:'',
                        rows: 1,
                        neededFeeds: this.feedsPerRow,
                        startIndex: 0,
                        feeds: [],
                        ffmpeg: ffmpeg(),
                        feedsInputOptions: this.inputOptions,
                        feedsOutputOptions: this.outputOptions,
                        watchers: 0,
                        initSIGKILL: false
                    },
                    {
                        init$: false,
                        streamName: '1',
                        mosaicCommand: '',
                        rows: 1,
                        neededFeeds: this.feedsPerRow,
                        startIndex: 5,
                        feeds: [],
                        ffmpeg: ffmpeg(),
                        feedsInputOptions: this.inputOptions,
                        feedsOutputOptions: this.outputOptions,
                        watchers: 0,
                        initSIGKILL: false
                    }
                ]
            } else {
                this.streams = [
                    {
                        init$: false,
                        streamName: '0',
                        mosaicCommand: '',
                        rows: 1,
                        neededFeeds: 4,
                        startIndex: 0,
                        feeds: [],
                        ffmpeg: ffmpeg(),
                        feedsInputOptions: this.inputOptions,
                        feedsOutputOptions: this.outputOptions,
                        watchers: 0,
                        initSIGKILL: false
                    } 
                ]
            }

            this.streamsInit = true;

            
            
            this.streamsInitCount = this.streams.length;
            
        }
    }

    async compileSettings() {
        this.inputOptions = this.defaultInputOptions;
        this.outputOptions= this.defaultOutputOptions

        let resize = '-resize '+this.feedWidth+'x'+this.feedHeight;


        if(this.settings.hwaccel && this.settings.hwaprov =='nvidia') {

            this.inputOptions = this.inputOptions.concat([resize]);
            this.inputOptions = this.inputOptions.concat(['-hwaccel cuvid',
            '-c:v h264_cuvid', '-zerolatency 1'])
        
        }
    }

    async assignFeeds() {
        let remainder: number = this.rows % this.streamsInitCount;
        let rowsPerStream: number = Math.floor(this.rows/this.streamsInitCount);
        let feedsPerStream: number = rowsPerStream*Number(this.settings.fpr)

        this.streams.forEach(async (stream, index) => {

            if(index > 0) {
                stream.startIndex = index * feedsPerStream
            } else {
                stream.startIndex = index * feedsPerStream     
            }
            
            if(index == (this.streams.length-1)) {
                stream.neededFeeds = feedsPerStream+(Math.ceil(remainder/Number(this.settings.fpr))*Number(this.settings.fpr));
                stream.rows = rowsPerStream+remainder;
                stream.feeds = this.feeds.slice(stream.startIndex, this.feeds.length);
                stream.mosaicCommand = await this.buildComplexFilter(stream.feeds, stream.rows);
            } else {
                stream.neededFeeds = feedsPerStream;
                stream.rows =rowsPerStream;
                stream.feeds = this.feeds.slice(stream.startIndex, (stream.startIndex+feedsPerStream))
                stream.mosaicCommand = await this.buildComplexFilter(stream.feeds, stream.rows);
            }
           
        })
    }

    async buildComplexFilter(feeds, rows, index = 0) {
        let buildCommand: string = '';
        let hstacks: string[] =  [];
        let hstackIndex: number=  0;
        let vstack: string =  '';
        let inputCounter: number = 0;
        let ptsOffest: number = feeds.length*this.ptsOffestIncrement
            

        feeds.forEach(async (feed, index)=> {
            if(feed.feedUrl) {
                

                if(this.settings.hwaccel) {
                    //buildCommand = buildCommand + '['+feed.inputIndex+':v] hwdownload, format=nv12, setpts=PTS-'+(this.ptsOffest-(feed.inputIndex*this.ptsOffestIncrement)).toFixed(2)+'/TB ['+feed.position+'];' 
                    buildCommand = buildCommand + '['+inputCounter+':v] fps=fps=15, setpts=PTS-'+(ptsOffest-((inputCounter-1)*this.ptsOffestIncrement)).toFixed(1)+'/TB, hwdownload, format=nv12 ['+index+'];'
                    //buildCommand = buildCommand + '['+feed.inputIndex+':v] hwdownload, format=nv12 ['+feed.position+'];'
                    /*
                    if(index == 0) {
                        buildCommand = buildCommand + '['+feed.inputIndex+':v] hwdownload, format=nv12, setpts=PTS-STARTPTS ['+feed.position+'];'
                    } else {
                        buildCommand = buildCommand + '['+feed.inputIndex+':v] hwdownload, format=nv12, setpts=PTS-PREV_INPTS ['+feed.position+'];'
                            
                    }
                    */
                } else {
                    buildCommand = buildCommand + '['+inputCounter+':v] fps=fps=15, setpts=PTS-'+(ptsOffest-((inputCounter-1)*this.ptsOffestIncrement)).toFixed(1)+'/TB, scale='+this.feedWidth+'x'+this.feedHeight+' ['+index+'];'    
                }

                inputCounter++;
   
        

                
            } else {
                if(feed.state != "CONNECTED") {
                    buildCommand = buildCommand + 'color=s='+this.feedWidth+'x'+this.feedHeight+':c=black, drawtext=text=\'Disconnected\':x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/Windows/Fonts/arial.ttf:fontsize=12:fontcolor=white ['+index+'];' 
                } else {
                    buildCommand = buildCommand + 'color=s='+this.feedWidth+'x'+this.feedHeight+':c=black, drawtext=text=\'No Input Selected\':x=(w-text_w)/2:y=(h-text_h)/2:fontfile=Windows/Fonts/arial.ttf:fontsize=12:fontcolor=white ['+index+'];'    
                }
            }

            if((index+1)-(hstackIndex*this.feedsPerRow) < this.feedsPerRow) {
                if(hstacks[hstackIndex]) {
                    hstacks[hstackIndex] = hstacks[hstackIndex] + '['+index+']'
                } else {
                    hstacks[hstackIndex] = '['+index+']'
                }
            } else {
                if(hstacks[hstackIndex]) {
                    hstacks[hstackIndex] = hstacks[hstackIndex] + '['+index+'] hstack='+this.feedsPerRow
                } else {
                    hstacks[hstackIndex] = '['+index+'] hstack='+this.feedsPerRow
                }
                

                if(feeds.length == (index+1) && rows == 1) {
                    hstacks[hstackIndex] = hstacks[hstackIndex] + ' [mosaic];'
                } else {
                    hstacks[hstackIndex] = hstacks[hstackIndex] + ' [h'+hstackIndex+'];'
                }

                if(rows > 1) {
                    if(feeds.length == (index+1)) {
                        vstack = vstack+'[h'+hstackIndex+'] vstack='+rows+' [mosaic];';
                    } else {
                        vstack = vstack+'[h'+hstackIndex+']';
                    }
                    
                }

                hstackIndex++; 
            }                
                
        })

        for(let stack of hstacks) {
            buildCommand = buildCommand + stack
        }

        if(rows > 1) {
            buildCommand = buildCommand + vstack
        }

        if(this.settings.hwaccel) {
              
            buildCommand = buildCommand + '[mosaic] setpts=PTS-6/TB, hwupload_cuda [output]';
            //buildCommand = buildCommand + '[mosaic] setpts=PTS-STARTPTS-'+((this.ptsOffestIncrement*this.live.length)+7).toFixed(0)+'/TB, hwupload_cuda [output]';
            //buildCommand = buildCommand + '[mosaic] hwupload_cuda [output]'
        }

        return buildCommand;

    }

    async execStreams() {
        this.streams.forEach((stream, index) => {
            for(let input of stream.feeds) {

                if(input.feedUrl) {
                    stream.ffmpeg.input(input.feedUrl)
                    .inputOptions(stream.feedsInputOptions).outputOptions(stream.feedsOutputOptions)
                    
                    if(input.type == 'unifi') {
                        stream.ffmpeg.inputOptions(['-analyzeduration 50'])
                    }
                    
                }
                

            }

           

           if(this.settings.hwaccel) {
               //console.log(stream.mosaicCommand);
                stream.ffmpeg.complexFilter(stream.mosaicCommand, ['output']);
                //stream.ffmpeg.outputOptions(['-framerate 30', '-r 30']);
                if(this.settings.hwaprov =='nvidia') {
                    stream.ffmpeg.outputOptions(['-c:v h264_nvenc', '-framerate 30', '-r 30000/1001', '-zerolatency 1', '-preset llhp', '-profile high', '-b:v 5M', '-bufsize 5M', '-maxrate 5M', '-g 60', '-crf 0', '-vsync 1' ]);
                    //this.command.outputOptions(['-c:v h264_nvenc', '-zerolatency 1']);
                }
                //this.command.outputOptions(['-framerate 30', '-r 30', '-vsync 1']);

                
                
            } else {
                stream.ffmpeg.complexFilter(stream.mosaicCommand, ['mosaic']);
                stream.ffmpeg.outputOptions(['-framerate 30', '-r 30', '-vsync 1']);
                stream.ffmpeg.outputOptions(['-c:v libx264']);
            }

            //this.command.outputOptions(['-maxrate 14M', '-bufsize 14M', '-g 60']);
            
            //this.command.flvmeta().format('flv').outputOptions(['-muxdelay 0.1'])
            stream.ffmpeg.format('flv').outputOptions(['-muxdelay 0.1'])
            .output('rtmp://localhost/live/'+stream.streamName)
            .on('start', function(start) {
                //console.log('Processing Started Stream: '+ stream.streamName);
            })
            .on('error', (err, stdout, stderr) => {
                console.log({ initSIGKILL: stream.initSIGKILL });
                if(!stream.initSIGKILL) {
                    this.websocketService.websocketRelaySubject$.next({ channel: 'err', message: { data: { component: 'ffmpeg', stream: stream.streamName, details: stderr }, message: err.message } });
                }
                console.log('An error occurred: ' + err.message);
                console.log('stdout', stdout);
                console.log('stderr', stderr);
            }).on('progress', function(progress) {
                //console.log('[ffmpeg]', progress);
              })
            .on('end', function() {
                //console.log('Processing finished !');
            });
            
            stream.ffmpeg.run();

        })
    }

    async initFullScreen(feed: LiveDto) {
        let streamPathArr =  feed.fullResFeedUrl.split("/");
        let streamName =  streamPathArr[streamPathArr.length-1];
        let fullScreenStream: FullSceenStream = {};
        let existing_full_screen_stream: FullSceenStream[] = this.fullScreenStream.filter(stream => stream.streamName == streamName);
        
        if(existing_full_screen_stream.length == 1) {
            if(existing_full_screen_stream[0].init$ && existing_full_screen_stream[0].ffmpeg) {
                return existing_full_screen_stream[0];
            } else {
                fullScreenStream = existing_full_screen_stream[0];
            }
        } 
        
        if(fullScreenStream) {
            if(fullScreenStream.init$ && fullScreenStream.ffmpeg) {
                fullScreenStream.initSIGKILL = true;
                fullScreenStream.ffmpeg.kill('SIGKILL');
                fullScreenStream.init$ = false;
                fullScreenStream.watchers = 0;
            }
        }
        

        fullScreenStream.streamName = streamName;
        fullScreenStream.feed = feed;
        fullScreenStream.ffmpeg = ffmpeg();
        fullScreenStream.watchers = 0;
        fullScreenStream.initSIGKILL = false;

        fullScreenStream.ffmpeg.input(fullScreenStream.feed.fullResFeedUrl).inputOptions(['-fflags nobuffer', '-hwaccel qsv', '-c:v h264_qsv'])

        if(streamPathArr[0] == 'rtmp:') {
            fullScreenStream.ffmpeg.inputOptions(['-rtmp_buffer 500'])
        }

        fullScreenStream.ffmpeg.outputOptions(['-max_muxing_queue_size 512', '-framerate 15', '-r 15', '-c:v h264_qsv', /*'-preset superfast', '-tune zerolatency',*/ '-c:a aac', '-ar 44100', '-b:v 5M', '-bufsize 5M', '-maxrate 5M', '-g 60', '-vsync 1']);
        

         fullScreenStream.ffmpeg.flvmeta().format('flv')
         .output('rtmp://localhost/live/'+fullScreenStream.streamName)
         .on('start', function(start) {
             //console.log('Processing Started');
         })
         .on('error',(err, stdout, stderr) => {
            console.log({ initSIGKILL: fullScreenStream.initSIGKILL })
            if(!fullScreenStream.initSIGKILL) {
                this.websocketService.websocketRelaySubject$.next({ channel: 'err', message: { data: { component: 'ffmpeg', stream: fullScreenStream.streamName, details: stderr }, message: err.message } });
            }
            
             console.log('An error occurred: ' + err.message);
             console.log('stdout', stdout);
             console.log('stderr', stderr);
         }).on('progress', function(progress) {
             //console.log('[ffmpeg]', progress);
           })
         .on('end', function() {
             //console.log('Processing finished !');
         });
         
         fullScreenStream.ffmpeg.run();

         this.fullScreenStream.push(fullScreenStream)

         return fullScreenStream
        
    }

    public async updateWatchers(streamName: string, countAdjuster: number) {
        for(let stream of this.streams) {
            if(streamName == stream.streamName) {
                stream.watchers = stream.watchers + countAdjuster;
            }
            //console.log('Watched Update', stream)    
        }

        for(let stream of this.fullScreenStream) {
            if(streamName == stream.streamName) {
                stream.watchers = stream.watchers + countAdjuster;
            }
            //console.log('Watched Update', stream)  
        }

        this.fullScreenStream.forEach((stream, index) => {
            if(stream.init$ && stream.watchers == 0) {
                stream.initSIGKILL = true;
                stream.ffmpeg.kill('SIGKILL');
                stream.init$ = false;
                //console.log('Stopping Full Stream', stream)
                this.fullScreenStream.splice(index, 1);
                
            }  
        })
    }

    async onApplicationShutdown() {
        for(let stream of this.streams) {
            if(stream.init$ && stream.ffmpeg) {
                stream.initSIGKILL = true;
                stream.ffmpeg.kill('SIGKILL');
                stream.init$ = false;
                stream.feedsInputOptions = this.inputOptions;
                stream.feedsOutputOptions = this.outputOptions;    
            }
        }

        for(let stream of this.fullScreenStream) {
            if(stream.init$ && stream.ffmpeg) {
                stream.initSIGKILL = true;
                stream.ffmpeg.kill('SIGKILL');
                stream.init$ = false;
            }
        }
    }
}