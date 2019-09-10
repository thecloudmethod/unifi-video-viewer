export class SettingsDto {
    readonly fpr: string;
    readonly tpw: string;
    readonly hwaccel: boolean;
    readonly hwaprov: 'nvidia' | 'intel';
}