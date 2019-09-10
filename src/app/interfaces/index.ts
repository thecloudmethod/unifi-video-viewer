export interface UnifiVideoServer {
    protocol?:  "http" | "https";
    host: string;
    port?: number;
    apikey: string;
    
  }
  
  export interface StreamUrl {
    name: string;
    url: string
  }

  export interface Settings {
    fpr: string;
    tpw: string;
    hwaccel: boolean,
    hwaprov: string
  }

  export interface Live {
    position: number;
    feedUrl: string;
    fullResFeedUrl: string;
    type: 'unifi' | 'single' | null;
    _id?: string;
    controllerHostId?: string;
  }