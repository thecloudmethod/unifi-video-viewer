import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { Observable, } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// Services
import { HttpService } from '@nestjs/common';

// Interfaces
import { Nvr } from '../interfaces/nvr.interface';

@Injectable()
export class UnifiNvrApiService {
    constructor(
        private readonly httpService: HttpService
    ) {}

    getCameraList(nvr: Nvr): Observable<any> {
        return this.getCameras(nvr).pipe(
            map(cameras => {
                const filteredCameras: any[] = cameras.data
                    .filter(camera => camera.managed && !camera.managedByOthers)
                    .map(camera =>{

                        return {
                            name: camera.name,
                            uuid: camera.uuid,
                            state: camera.state,
                            controllerHostAddress: nvr.host,
                            controllerHostId: nvr._id,
                            filteredChannels: camera.channels.map(channel => {
                                return {
                                    id: channel.id,
                                    name: channel.name,
                                    enabled: channel.enabled,
                                    isRtmpEnabled: channel.isRtmpEnabled,
                                    rtmpUris: channel.rtmpUris.filter(uris => uris.includes(nvr.host)),
                                    isRtmpsEnabled: channel.isRtmpsEnabled,
                                    rtmpsUris: channel.rtmpsUris.filter(uris => uris.includes(nvr.host)),
                                    width: channel.width,
                                    height: channel.height,
                                    fps: channel.fps,
                                    bitrate: channel.bitrate,
                                    minBitrate: channel.minBitrate,
                                    maxBitrate: channel.maxBitrate,
                                    fpsValues: channel.fpsValues,
                                    idrInterval: channel.idrInterval,
                                    isAdaptiveBitrateEnabled: channel.isAdaptiveBitrateEnabled
                                }
                            }),
                            thumbnailUrl: this.generateNvrUrl(nvr, 'snapshot/camera/'+camera._id)+'&width=100',
                            type: 'unifi',
                            _id: camera._id
                        }
                        
                    })

                return filteredCameras;
            })
        )
    }

    getCameras(nvr: Nvr): Observable<any> {
        return this.httpService.get( this.generateNvrUrl(nvr, 'camera')).pipe(map(res => res.data));
    }

    getNvrBootstrap(nvr: Nvr): Observable<any> {
        return this.httpService.get( this.generateNvrUrl(nvr, 'bootstrap')).pipe(
            map(res => res.data),
            catchError(
                err => {
                    throw new HttpException({
                        status: HttpStatus.GATEWAY_TIMEOUT,
                        error: 'Timeout connecting to NVR.',
                      }, 504);
                } 
            )
        );
    }

    enableRtmp(nvr: Nvr, data: any): Observable<any> {
        return this.httpService.put( this.generateNvrUrl(nvr, 'camera/'+data._id), data).pipe(
            map(res => res.data),
            catchError(
                err => {
                    throw new HttpException({
                        status: HttpStatus.INTERNAL_SERVER_ERROR,
                        error: 'Error Enabling RTMP',
                      }, 500);
                } 
            )
        );
    }

    private generateNvrUrl(nvr: Nvr, apiUrl: string): string {
        const requiredNvr: Nvr = { protocol: 'https', port: '7443', ...nvr };

        return requiredNvr.protocol+'://'+requiredNvr.host+':'+requiredNvr.port+'/api/2.0/'+apiUrl+'?apiKey='+requiredNvr.apikey
    }
}