export const ANALYTICS_EVENTS = Object.freeze({
  APP_OPEN: 'app_open',
  APP_ERROR: 'app_error',
  LOCAL_LIBRARY_CONNECTED: 'local_library_connected',
  LOCAL_LIBRARY_CONNECTION_FAILED: 'local_library_connection_failed',
  MATCH_FAVORITE_CHANGED: 'match_favorite_changed',
  MATCH_WATCHED_CHANGED: 'match_watched_changed',
  PAGE_VIEW: 'page_view',
  RECORDING_STARTED: 'recording_started',
  RECORDING_STOPPED: 'recording_stopped',
  REVIEW_EDITOR_OPENED: 'review_editor_opened',
  REVIEW_SAVED: 'review_saved',
  TRAINING_EDITOR_OPENED: 'training_editor_opened',
  TRAINING_SAVED: 'training_saved',
})

export const ANALYTICS_EVENT_DEFINITIONS = Object.freeze({
  [ANALYTICS_EVENTS.APP_OPEN]: defineEvent('app', [], '应用初始化完成。'),
  [ANALYTICS_EVENTS.APP_ERROR]: defineEvent('error', ['errorCode', 'errorType', 'source'], '应用捕获到的非敏感错误类型。'),
  [ANALYTICS_EVENTS.LOCAL_LIBRARY_CONNECTED]: defineEvent('local_library', ['connected', 'success'], '本地资料包成功连接。'),
  [ANALYTICS_EVENTS.LOCAL_LIBRARY_CONNECTION_FAILED]: defineEvent('local_library', ['connected', 'errorCode', 'errorType', 'success'], '本地资料包连接失败。'),
  [ANALYTICS_EVENTS.MATCH_FAVORITE_CHANGED]: defineEvent('match', ['favorite', 'matchId', 'success'], '比赛收藏状态已成功改变。'),
  [ANALYTICS_EVENTS.MATCH_WATCHED_CHANGED]: defineEvent('match', ['matchId', 'success', 'watched'], '比赛已看状态已成功改变。'),
  [ANALYTICS_EVENTS.PAGE_VIEW]: defineEvent('navigation', ['path', 'source'], '有效路由发生切换。'),
  [ANALYTICS_EVENTS.RECORDING_STARTED]: defineEvent('training', ['matchId', 'mediaType', 'success', 'trainingId'], '录音或录像实际开始。'),
  [ANALYTICS_EVENTS.RECORDING_STOPPED]: defineEvent('training', ['durationMs', 'matchId', 'mediaType', 'success', 'trainingId'], '录音或录像实际停止。'),
  [ANALYTICS_EVENTS.REVIEW_EDITOR_OPENED]: defineEvent('review', ['matchId', 'reviewId', 'source'], '赛评编辑页成功打开。'),
  [ANALYTICS_EVENTS.REVIEW_SAVED]: defineEvent('review', ['contentLength', 'contentLengthRange', 'matchId', 'reviewId', 'source', 'status', 'success'], '赛评已成功保存。'),
  [ANALYTICS_EVENTS.TRAINING_EDITOR_OPENED]: defineEvent('training', ['matchId', 'mediaType', 'reviewId', 'source', 'trainingId'], '训练编辑页成功打开。'),
  [ANALYTICS_EVENTS.TRAINING_SAVED]: defineEvent('training', ['durationMs', 'matchId', 'mediaType', 'reviewId', 'source', 'success', 'trainingId'], '训练元数据已成功保存。'),
})

export function getAnalyticsEventDefinition(eventName) {
  return ANALYTICS_EVENT_DEFINITIONS[eventName] ?? null
}

function defineEvent(category, allowedProperties, description) {
  return Object.freeze({
    allowedProperties: Object.freeze(allowedProperties),
    category,
    description,
  })
}
