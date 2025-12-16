export default class PCOnlineInfo {
    /**
     * {@type PcOnlineType}
     */
    type = 0;
    /**
     *
     * @type {number}
     * Platform_UNSET = 0;
     * Platform_iOS = 1;
     * Platform_Android = 2;
     * Platform_Windows = 3;
     * Platform_OSX = 4;
     * Platform_WEB = 5;
     * Platform_WX = 6;
     * Platform_LINUX = 7;
     * Platform_iPad = 8;
     * Platform_APad = 9;
     * Platform_Harmony = 10;
     * Platform_Harmony_Pad = 11;
     * Platform_Harmony_PC = 12;
     */
    platform = 0;
    isOnline = false;
    clientId = '';
    clientName = '';
    timestamp = 0;

    static infoFromStr(value, type) {
        let parts = value.split('|');
        if (parts.length >= 4) {
            let info = new PCOnlineInfo();
            info.type = type;
            info.timestamp = Number(parts[0]);
            info.platform = Number(parts[1]);
            info.clientId = parts[2];
            info.clientName = parts[3];
            info.isOnline = true;
            return info;
        }
        return null;
    }
}