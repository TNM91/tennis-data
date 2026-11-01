import {registerPlugin} from '@capacitor/core'

// Notification Center cleanup must also work before this launch registers for APNs.
export const nativeNotificationCleanup=registerPlugin<{clearDelivered:()=>Promise<void>;setBadge:(options:{count:number})=>Promise<{applied:boolean}>}>('TiqNotifications')
