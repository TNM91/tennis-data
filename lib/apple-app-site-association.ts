// This is the application-identifier in the existing production signing profile.
// Deliberately exclude authentication, account, billing and administration URLs.
export const appleAppSiteAssociation={applinks:{details:[{appIDs:['6C5MPYLRVQ.com.tenaceiq.app'],components:[
 {'/':'/coach/invite/*/*',exclude:true}, {'/':'/explore/leagues/tiq/*/*',exclude:true},
 {'/':'/tournaments/*/*',exclude:true}, {'/':'/matches/*/*',exclude:true},
 {'/':'/coach/invite/*'}, {'/':'/team-room/join'}, {'/':'/team-room'},
 {'/':'/explore/leagues/tiq/*'}, {'/':'/tournaments/*'}, {'/':'/matches/*'},
]}]}}
