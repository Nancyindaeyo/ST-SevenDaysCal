export const THEATER_KEY = 'sp-theater';
export const THEATER_SCHEMA_VERSION = 1;
export const THEATER_DRAFT_CAP = 12;
export const THEATER_TEMPLATE_BOOK = '构画-棱-小剧场模板';
export const THEATER_EXPORT_BOOK = '构画-棱-兔子镜母本';
export const THEATER_COUNT_DEFAULT = 2;
export const theaterDraftKey = chatId => `sp-cache-${String(chatId ?? '')}-theater-draft-user`;
