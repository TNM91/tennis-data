// Public Play distribution certificate, independently verified from the
// Play-installed APK. Grant content-link handling only to the production app.
export const androidAppLinks = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: 'com.tenaceiq.app',
    sha256_cert_fingerprints: ['F1:00:99:F0:01:12:60:B4:B0:5C:CD:C4:41:8F:17:88:7B:A2:D2:8A:1B:5A:4F:99:65:52:9D:9C:87:D4:6F:1F'],
  },
  relation_extensions: {
    'delegate_permission/common.handle_all_urls': {
      dynamic_app_link_components: [
        {'?': {next: '*'}, exclude: true},
        {'/': '/coach/invite/*/*', exclude: true},
        {'/': '/explore/leagues/tiq/*/*', exclude: true},
        {'/': '/tournaments/*/*', exclude: true},
        {'/': '/matches/*/*', exclude: true},
        // These practice URLs use the existing website flow. The native
        // content-link parser does not yet resolve their private team scope.
        {'/': '/team-room', '?': {practice: '*'}, exclude: true},
        {'/': '/team-room', '?': {practiceReminder: '*'}, exclude: true},
        {'/': '/coach/invite/*'},
        {'/': '/team-room/join', '?': {token: '*'}},
        {'/': '/team-room', '?': {team: '*', league: '*'}},
        {'/': '/chats/join', '?': {invite: '*'}},
        {'/': '/chats', '?': {room: '*'}},
        {'/': '/explore/leagues/tiq/*'},
        {'/': '/tournaments/*'},
        {'/': '/matches/*'},
        {'/': '*', exclude: true},
      ],
    },
  },
}]
