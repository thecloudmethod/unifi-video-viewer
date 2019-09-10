export class LiveDto {
    readonly position: number;
    readonly feedUrl: string;
    readonly fullResFeedUrl: string;
    readonly type: 'unifi' | 'single' | null;
    readonly _id?: string;
    readonly controllerHostId?: string;
    inputIndex?: number;
    state?: string;
}