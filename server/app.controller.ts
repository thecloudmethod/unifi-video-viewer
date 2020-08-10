import { Controller, Get, Post, Delete, Param, Body, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { forkJoin, Observable } from 'rxjs';

import { v4 as uuidv4 } from 'uuid';

// DTO's
import { AddNvrDto } from './interfaces/add-nvr.dto';
import { AddSingleSourceUrlDto } from './interfaces/add-single-source-url.dto'
import { SettingsDto } from './interfaces/settings.dto';
import { LiveDto } from './interfaces/live.dto';

// Interfaces
import { Nvr } from './interfaces/nvr.interface';

//Services
import { UnifiNvrApiService } from './services/unifi-nvr-api.service';
import { StorageService } from './services/storage.service';
import { FfmpegService } from './services/ffmpeg.service';

//const si = require('systeminformation');

@Controller()
export class AppController {
  constructor(
    @Inject(forwardRef(() => UnifiNvrApiService))
    private readonly unifiNvrApiService: UnifiNvrApiService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => FfmpegService))
    private ffmpegService: FfmpegService
  ) {

  }

  settings: any;

  @Get('api/speakers')
  findAllSpeakers(): any[] {
    return [
      {
        name: 'Name Dudeman',
        talk: 'Angular for your face',
        image: 'http://via.placeholder.com/50x50',
      },
      {
        name: 'Some Person',
        talk: 'High-five typescript',
        image: 'http://via.placeholder.com/50x50',
      },
      {
        name: 'Samwise Gamgee',
        talk: 'Lord of the Angular',
        image: 'http://via.placeholder.com/50x50',
      },
    ];
  }

  @Get('api/reset')
  resetStreams(): any {
    this.ffmpegService.triggerReload();
    return { reset: true }
  }
  
  @Get('api/cameras')
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

  @Get('api/live')
  async getLive(){
    let feeds: LiveDto[] = [];
    const live: LiveDto[] = await this.storageService.storage().getItem("live");
    let settings: SettingsDto = await this.storageService.storage().getItem("settings");

    let feedCount = Number(settings.fpr)*Number(settings.fpr);
    if(live) {

      if(live.length >= feedCount) {
        feedCount = Math.ceil((live.length+1)/Number(settings.fpr))*Number(settings.fpr);        
      }

      let i;
      for (i = 0; i < feedCount; i++) {
        let live_copy = live;
        let matchingFeed = live_copy.filter(feed => feed.position == i);

        if(matchingFeed.length > 0) {
          feeds.push(matchingFeed[0]);
        } else {
          feeds.push({
            position: i,
            feedUrl: null,
            fullResFeedUrl: null,
            type: null
          })
        }
      }
    
      return { data: feeds, count: feeds.length }
    } else {
      
      let i;
      for (i = 0; i < feedCount; i++) {
        feeds.push({
            position: i,
            feedUrl: null,
            fullResFeedUrl: null,
            type: null
          })
      }

      return { data: feeds, count: feeds.length }
    }
  }

  @Delete('api/live/:id')
  async deleteFeed(@Param() params) {
    let live = await this.storageService.storage().getItem("live");
    if(live) {
      let selected: any[] = live.filter(live => live.position == params.id);
      
      const index = live.indexOf(selected[0], 0);
      if (index > -1) {
        live.splice(index, 1);

        await this.storageService.storage().setItem("live",live);
        this.ffmpegService.liveSubject$.next(live);
        return await this.getLive();
      } else {
        throw new HttpException({
          status: HttpStatus.NOT_ACCEPTABLE,
          error: 'Feed not found',
        }, 406); 
      }
      
    } else {
      throw new HttpException({
        status: HttpStatus.NOT_ACCEPTABLE,
        error: 'Feed not found',
      }, 406);  
    }
    
  }

  @Post('api/live')
  async addLive(@Body() liveDto: LiveDto) {
    let live: LiveDto[] = await this.storageService.storage().getItem("live");

    if(live) {
      let duplicate: any[] = live.filter(live_sources => live_sources.position == liveDto.position);

      if(duplicate.length > 0) {
        const index = live.indexOf(duplicate[0], 0);
        if (index > -1) {
          await this.enableRtmpUnifi(liveDto);

          live.splice(index, 1);
          live.push(liveDto)

          return await this.saveAndSortLive(live);
        } else {
          throw new HttpException({
            status: HttpStatus.INTERNAL_SERVER_ERROR
          }, 500); 
        }
      } else {
        await this.enableRtmpUnifi(liveDto);

        live.push(liveDto);

        return await this.saveAndSortLive(live);
      }

    } else {
      await this.enableRtmpUnifi(liveDto);
      
      live = [liveDto];

      return await this.saveAndSortLive(live);
    }
  }

  @Post('api/full_screen')
  async fullScreen(@Body() liveDto: LiveDto) {
    return await this.ffmpegService.initFullScreen(liveDto);
  
  }

  async saveAndSortLive(live) {
    if(live.length > 1) {
      live.sort(function(a, b){
        if(a.position < b.position) { return -1; }
        if(a.position > b.position) { return 1; }
        return 0;
      })
    }

    await this.storageService.storage().setItem("live", live);

    this.ffmpegService.liveSubject$.next(live);

    return { data: live, count: live.length };  
  }

  async enableRtmpUnifi(liveDto: LiveDto) {
    if(liveDto.type == 'unifi') {
      let nvrs = await this.storageService.storage().getItem("nvrs");
      let nvr: Nvr[] = nvrs.filter(nvrs => nvrs._id == liveDto.controllerHostId);

      this.unifiNvrApiService.getNvrBootstrap(nvr[0]).subscribe(res => {

        let feed = res.data[0].cameras.filter(camera => camera._id == liveDto._id)

        feed = feed[0];

        feed.channels[0].isRtmpEnabled = true;
        feed.channels[feed.channels.length - 1].isRtmpEnabled = true;

        this.unifiNvrApiService.enableRtmp(nvr[0], feed).subscribe(camera => {
          
        })
      })
    }
  }

  @Get('api/feeds')
  async getAllFeeds(){
    let nvrs = await this.storageService.storage().getItem("nvrs");
    let nvrs$: Observable<any>[] = [];
    
    for(let nvr of nvrs) {
      nvrs$.push(this.unifiNvrApiService.getCameraList(nvr))
    }

    return forkJoin(...nvrs$).pipe(map(async res => {
      let cameras: any [] = [];
      for(let nvr of res) {
        cameras = cameras.concat(nvr);
      }

      let single_sources = await this.storageService.storage().getItem("single_sources");

      cameras = cameras.concat(single_sources.map(source => { return {type: "single", thumbnailUrl: "/assets/feed-placeholder.jpg", ...source} }))
    
      cameras.sort(function(a, b){
        if(a.name < b.name) { return -1; }
        if(a.name > b.name) { return 1; }
        return 0;
      })

      return { data: cameras, count: cameras.length }
    }));
  }

  @Get('api/nvr-cameras')
  async getNvrCameras(){
    return this.unifiNvrApiService.getCameras({ 
    protocol: 'https',
    host: '192.168.1.28',
    apikey: 'lomYXYfD65fehCzgEJIEAVaET46nshYU',
    port: '7443' });
  }

  

  @Get('api/nvr')
  async getNvrs() {
    return { data: await this.storageService.storage().getItem("nvrs") };
  }

  @Delete('api/nvr/:id')
  async deleteNvr(@Param() params) {
    let nvrs = await this.storageService.storage().getItem("nvrs");
    if(nvrs) {
      let nvr: any[] = nvrs.filter(nvrs => nvrs._id == params.id);
      
      const index = nvrs.indexOf(nvr[0], 0);
      if (index > -1) {
        
          const live = await this.storageService.storage().getItem("live");
          let live_filtered = live.filter(each => !each.feedUrl.includes(nvr[0].host) && each.type == 'unifi');

          await this.storageService.storage().setItem("live", live_filtered);
          this.ffmpegService.liveSubject$.next(live_filtered);
      


        nvrs.splice(index, 1);

        await this.storageService.storage().setItem("nvrs",nvrs);
        return nvrs;
      } else {
        throw new HttpException({
          status: HttpStatus.NOT_ACCEPTABLE,
          error: 'NVR not found',
        }, 406); 
      }
      
    } else {
      throw new HttpException({
        status: HttpStatus.NOT_ACCEPTABLE,
        error: 'NVR not found',
      }, 406);  
    }
    
  }

  @Post('api/nvr')
  async validateNvr(@Body() addNvrDto: AddNvrDto) {
    return this.unifiNvrApiService.getNvrBootstrap(addNvrDto).pipe(
      map(async data => {

        // If isLoggedIn is true apiKey is valid.
        if(data.data[0].isLoggedIn) {

          // Get saved NVR's from persisten storage
          let nvrs = await this.storageService.storage().getItem("nvrs");

          // Compile NVR to save to storage
          let nvr = {
            _id: data.data[0].settings._id,
            name: data.data[0].nvrName,
            ...addNvrDto
          }

          // Test if any NVR's were in storage
          if(nvrs) {
            let duplicate: any[] = nvrs.filter(nvrs => nvrs._id == nvr._id);
            
            //If duplicate do not return NVR bootrsrap data
            if(duplicate.length > 0) {
              throw new HttpException({
                status: HttpStatus.NOT_ACCEPTABLE,
                error: 'Duplicate NVR',
              }, 406);
            } else {
              nvrs.push(nvr);
              await this.storageService.storage().setItem("nvrs",nvrs);
              return data;
            }
            
          } else {
            nvrs = [nvr] ;
            await this.storageService.storage().setItem("nvrs",nvrs);
            return data;
          }
        } else {
          return data;
        }
      })
    );
    
  }

  @Get('api/single-source-stream')
  async getSourceStream() {
    return { data: await this.storageService.storage().getItem("single_sources") };
  }

  @Post('api/single-source-stream')
  async addSingleSourceStream(@Body() addSingleSourceUrlDto: AddSingleSourceUrlDto) {
    let single_sources = await this.storageService.storage().getItem("single_sources");

    // Compile source to save to storage
    let single_source = {
      _id: uuidv4(),
      ...addSingleSourceUrlDto
    }
    if(single_sources) {
      single_sources._id = uuidv4();
      let duplicate: any[] = single_sources.filter(single_sources => single_sources.url == single_source.url);
      //If duplicate do not return NVR bootrsrap data
      if(duplicate.length > 0) {
        throw new HttpException({
          status: HttpStatus.NOT_ACCEPTABLE,
          error: 'Duplicate Source',
        }, 406);
      } else {
        single_sources.push(single_source);
        await this.storageService.storage().setItem("single_sources",single_sources);
        return { data: single_sources };
      }
      
    } else {
      single_sources = [single_source] ;
      await this.storageService.storage().setItem("single_sources",single_sources);
      return { data: single_sources };
    }
  }

  @Delete('api/single-source-stream/:id')
  async deleteSingleSource(@Param() params) {
    let single_sources = await this.storageService.storage().getItem("single_sources");
    if(single_sources) {
      let single_source: any[] = single_sources.filter(single_sources => single_sources._id == params.id);
      
      const index = single_sources.indexOf(single_source[0], 0);
      if (index > -1) {

        const live = await this.storageService.storage().getItem("live");
        let live_filtered = live.filter(each => each.feedUrl != single_source[0].url && each.type == 'single');

        await this.storageService.storage().setItem("live", live_filtered);
        this.ffmpegService.liveSubject$.next(live_filtered);

        single_sources.splice(index, 1);

        await this.storageService.storage().setItem("single_sources",single_sources);
        return single_sources;
      } else {
        throw new HttpException({
          status: HttpStatus.NOT_ACCEPTABLE,
          error: 'Source not found',
        }, 406); 
      }
    } else {
      throw new HttpException({
        status: HttpStatus.NOT_ACCEPTABLE,
        error: 'Source not found',
      }, 406);  
    }
    
  }

  @Get('api/settings')
  async getSettings() {
    //si.graphics().then(data => console.log(data)).catch(error => console.error(error));

    return { data: await this.storageService.storage().getItem("settings") };
  }

  @Post('api/settings')
  async addSettings(@Body() settingsDto: SettingsDto) {
    let settings = await this.storageService.storage().getItem("settings");

    // Compile source to save to storage
    let setting: SettingsDto = {
      fpr: '4',
      tpw: '1920',
      hwaccel: true,
      hwaprov: 'nvidia',
       ...settingsDto
    }
    
    await this.storageService.storage().setItem("settings",setting);

    let live: LiveDto[] = await this.storageService.storage().getItem("live");
    this.ffmpegService.liveSubject$.next(live);
  }
}
