export interface ServerListMember {
    url: string;
    id: string;
    active: boolean;
    updated_time: number;
    created_time: number;
}
export interface StatusBody {
    name: string;
    version: string;
    message: string;
    website: string;
    server_id: string;
    server_status: ChildServerStatus;
    requests: ChildRequests;
    feedback: {
        Kuertianshi: string;
        freejishu: string;
        a632079: string;
    };
    copyright: string;
    now: string;
    ts: number;
}
export interface ChildRequests {
    all: RequestsAll;
    hosts: {
        'v1.hitokoto.cn': HostChild;
        'sslapi.hitokoto.cn': HostChild;
        'api.hitokoto.cn': HostChild;
        'api.a632079.me': HostChild;
        'international.v1.hitokoto.cn': HostChild;
    };
}
export interface ChildServerStatus {
    memory: MemoryStatus;
    load: number[];
    hitokto: HitokotoStatus;
}
export interface HitokotoStatus {
    total: number;
    categroy: string[];
    lastUpdate?: number;
}
export interface MemoryStatus {
    totol: number;
    free: number;
    usage: number;
}
export interface RequestsAll {
    total: number;
    pastMinute: number;
    pastHour: number;
    pastDay: number;
    dayMap: number[];
    FiveMinuteMap: number[];
}
export interface HostChild {
    total: number;
    pastMinute: number;
    pastHour: number;
    pastDay: number;
    dayMap: number[];
}
export interface DownServerData {
    id: string;
    startTs: number;
    last: number;
    statusMessage: NetworkError;
}
export interface ExportData {
    version: string;
    children: string[];
    downServer: DownServerData[];
    status: {
        load: number[];
        memory: number;
        hitokoto: HitokotoStatus;
        childStatus: ChildServerStatus[];
    };
    requests: {
        all: RequestsAll;
        hosts: {
            'v1.hitokoto.cn': HostChild;
            'international.v1.hitokoto.cn': HostChild;
        };
    };
    lastUpdate: number;
    now: string;
    ts: number;
}
export interface NetworkError {
    isError: boolean;
    id: string;
    code: number;
    msg: string;
    stack: string;
    ts: number;
}
export interface DownServerListInterface {
    ids: string[];
    data: DownServer[];
}
export interface DownServer {
    id: string;
    start: number;
    statusMsg: NetworkError;
}
export declare function applyMerge(children: StatusBody[], downServerList: NetworkError[]): Promise<void>;
