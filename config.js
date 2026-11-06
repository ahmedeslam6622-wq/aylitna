/* ═══════════════════════════════════════════════════════════
   config.js — every setting, key and list in one place.
   Change a limit, a theme colour or an occasion here, not in app.js.
   Loaded before app.js.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const CFG = {
  SB_URL: 'https://ptpprauzusyrbrigfyji.supabase.co',
  SB_KEY: 'sb_publishable_K4QVE01BB4XSfmUlemIJZQ_TyFDDR1H',
  CLD_IMG: { cloud: 'df618arjm', preset: 'zsz6vswy' },
  CLD_VID: { cloud: 'hhjzkoeh', preset: 'aylitna-video' },
  VAPID: 'BClsAtEWOVK95B0atTRO4d6-QacLuKZg_X5p6r3YXKaOI35BF7TsRR-NOPDnEC_omwyZQRiQtqgeZWmbs6hasUw',
  METERED_KEY: 'JSia8dCBTVVw7f8RmASIFQ4DhJ_YJSgHYpPAovOQ89T2cBN4',
  METERED_HOST: 'aylitna.metered.live',
  PEERJS_SRC: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',

  /* Passcode gate. Off, as in the old build (its gate was bypassed at runtime).
     To turn on: set true and set VERIFY_URL to your edge function. */
  GATE_ON: false,
  VERIFY_URL: 'https://ptpprauzusyrbrigfyji.supabase.co/functions/v1/verify-passcode',

  MAX_CAP: 300,       // caption length
  MAX_MEDIA: 10,      // photos/videos per post
  CMT_PAGE: 5,        // top-level comments shown at a time
  FEED_LIMIT: 60,     // posts fetched (was 120; fewer rows = less data & battery)
  IMG_MAX: 1400,      // px, longest side of an uploaded photo
  IMG_QUALITY: 0.8,
  CLD_TRANSFORM: true, // serve resized f_auto/q_auto images. Set false if Cloudinary "strict transformations" is on.
};

/* Avatar colour pairs (index is stored in profiles.color_idx — keep the order). */
const MC = [
  { bg: '#FAECE7', br: '#D85A30', tx: '#7A3010' }, { bg: '#E6F1FB', br: '#378ADD', tx: '#0E4A8A' },
  { bg: '#EAF3DE', br: '#5A9A1A', tx: '#2E5A08' }, { bg: '#FAEEDA', br: '#C47A10', tx: '#7A4A08' },
  { bg: '#EEEDFE', br: '#7A6AE0', tx: '#3A2AAA' }, { bg: '#E1F5EE', br: '#1A9A65', tx: '#0A5A3A' },
  { bg: '#FDE8F4', br: '#C4498A', tx: '#7A1050' }, { bg: '#E8F4FE', br: '#2A8AC4', tx: '#0A4A7A' },
];

/* Occasions (ids are stored in posts.oct — keep them). */
const OCTS = {
  everyday:  { l: 'Everyday',  e: '💛', bg: '#FAEEDA', br: '#C47A10', tx: '#7A4A08' },
  birthday:  { l: 'Birthday',  e: '🎂', bg: '#FAECE7', br: '#D85A30', tx: '#7A3010' },
  eid:       { l: 'Eid',       e: '🌙', bg: '#EEEDFE', br: '#7A6AE0', tx: '#3A2AAA' },
  travel:    { l: 'Travel',    e: '✈️', bg: '#E6F1FB', br: '#378ADD', tx: '#0E4A8A' },
  together:  { l: 'Together',  e: '👨‍👩‍👧‍👦', bg: '#EAF3DE', br: '#5A9A1A', tx: '#2E5A08' },
  home:      { l: 'Home',      e: '🏡', bg: '#E1F5EE', br: '#1A9A65', tx: '#0A5A3A' },
  food:      { l: 'Food',      e: '🍽️', bg: '#FDE8F4', br: '#C4498A', tx: '#7A1050' },
  milestone: { l: 'Milestone', e: '🏆', bg: '#FEF3C7', br: '#C47A10', tx: '#7A4A08' },
  prayer:    { l: 'Prayer',    e: '🤲', bg: '#EEEDFE', br: '#7A6AE0', tx: '#3A2AAA' },
  health:    { l: 'Health',    e: '💊', bg: '#E1F5EE', br: '#1A9A65', tx: '#0A5A3A' },
  goingout:  { l: 'Going out', e: '🎉', bg: '#FDE8F4', br: '#C4498A', tx: '#7A1050' },
};

/* Theme-colour (browser/status bar) per theme. Must match the CSS --bg values. */
const THEME_BG = {
  default: '#FAF8F3', midnight: '#0F0E17', rose: '#FFF5F7',
  forest: '#F4F7F2', ocean: '#F0F6FF', sand: '#FBF7EE', custom: '#FAF8F3',
};

/* View → tab index in the 5-slot tab bar (slot 2 is the + button). */
const TAB_SLOT = { feed: 0, chat: 1, stats: 3, members: 4 };
const VIEW_TITLE = {
  feed: 'Our Family', chat: 'Chat', add: 'New moment', stats: 'Stats',
  members: 'Family', user: 'Profile', edit: 'Edit profile',
};
