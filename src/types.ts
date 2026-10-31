export interface HealthResponse {
    name: string
    version: string
    status: 'operational' | 'degraded' | 'maintenance' | 'offline'
    endpoints?: {
        movie?: string
        tv?: string
        proxy?: string
    }
    spec: 'omss'
    note?: string
}

export interface AudioTrack {
    language: string // ISO 639-1
    label: string
}

export type SourceType = 'hls' | 'dash' | 'http' | 'mp4' | 'mkv' | 'webm'

export interface Provider {
    id: string
    name: string
}

export interface Source {
    url: string
    type: SourceType
    quality: string // e.g. "1080"
    audioTracks: AudioTrack[]
    provider: Provider
}

export type SubtitleFormat = 'vtt' | 'srt' | 'ass' | 'ssa'

export interface Subtitle {
    url: string
    label: string
    format: SubtitleFormat
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export interface Diagnostic {
    code: 'QUALITY_INFERRED' | 'LANGUAGE_INFERRED' | 'TYPE_INFERRED' | 'SUBTITLE_LABEL_INFERRED' | 'PROVIDER_ERROR' | 'PARTIAL_SCRAPE'
    message: string
    field?: string
    severity: DiagnosticSeverity
}

export interface SourceResponse {
    responseId: string
    expiresAt: string // ISO8601
    sources: Source[]
    subtitles: Subtitle[]
    diagnostics: Diagnostic[]
}

export interface RefreshResponse {
    status: 'OK'
}

export type ErrorCode =
    | 'INVALID_TMDB_ID'
    | 'INVALID_PARAMETER'
    | 'MISSING_PARAMETER'
    | 'INVALID_SEASON'
    | 'INVALID_EPISODE'
    | 'INVALID_RESPONSE_ID'
    | 'RESPONSE_ID_NOT_FOUND'
    | 'NO_SOURCES_AVAILABLE'
    | 'ENDPOINT_NOT_FOUND'
    | 'METHOD_NOT_ALLOWED'
    | 'INTERNAL_ERROR'
    | 'UNSUPPORTED_MEDIA_TYPE'

export interface ErrorObject {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
}

export interface ErrorResponse {
    error: ErrorObject
    traceId: string
}

/**
 * Generic wrapper shape returned by OmssClient methods.
 */
export type OmssResult<T> =
    | { data: T; error: null }
    | { data: null; error: ErrorResponse }

// ---- Scrobble (local playback progress / resume) ----
//
// An OMSS source backend is stateless, but a self-hosted one (e.g. gatearr) can additionally act as
// its own local "scrobble" server — tracking playback progress so a frontend can offer resume /
// "continue watching" and a watched list. These types + the OmssClient scrobble methods below cover
// that OMSS extension, served under `/scrobble` on the same host as the `/v1` source surface. A title
// is keyed by its TMDB identity: `m{tmdbId}` for a movie, `e{showTmdbId}-{season}-{episode}` for an
// episode. Backends that don't implement it simply 404 these routes.

export type ScrobbleAction = 'start' | 'pause' | 'stop'
export type ScrobbleMediaType = 'movie' | 'episode'
export type ScrobbleStatus = 'started' | 'paused' | 'stopped'

/** Body of `POST /scrobble`. `season`/`episode` are required for an episode, ignored for a movie. */
export interface ScrobbleRequest {
    mediaType: ScrobbleMediaType
    tmdbId: number
    season?: number
    episode?: number
    progress: number // 0–100, percent complete
    action: ScrobbleAction
    title?: string // optional display title, stored denormalized so clients needn't re-resolve it
}

/** The stored playback state for one title. */
export interface ScrobbleState {
    mediaKey: string // "m{tmdb}" | "e{tmdb}-{s}-{e}"
    mediaType: ScrobbleMediaType
    tmdbId: number
    season: number
    episode: number
    progress: number // 0–100
    status: ScrobbleStatus
    watched: boolean // true once stopped at ≥80%
    watchedAt: number // unix seconds; 0 if never
    updatedAt: number // unix seconds of the last scrobble
    title?: string | null // denormalized display title (movie title | show title); null if unknown
}

/** Acknowledgement returned by `POST /scrobble` (the upserted row's live state). */
export interface ScrobbleAck {
    mediaKey: string
    status: ScrobbleStatus
    progress: number
    watched: boolean
    watchedAt: number
    updatedAt: number
}

/** `GET /scrobble/playback` — resume / "continue watching": started-but-unfinished titles. */
export interface ScrobblePlaybackResponse {
    count: number
    data: ScrobbleState[]
}

/** `GET /scrobble/history` — watched titles, DataTables-style paging counters. */
export interface ScrobbleHistoryResponse {
    recordsTotal: number
    recordsFiltered: number
    data: ScrobbleState[]
}

/** `GET /scrobble/show/{tmdbId}` — a show's scrobbled episodes, ordered by season then episode. */
export interface ScrobbleShowResponse {
    count: number
    data: ScrobbleState[]
}

export type ResumeReason = 'in_progress' | 'next_up' | 'rewatch' | 'none'

/**
 * `GET /scrobble/resume/{type}/{tmdbId}` — the backend's "continue watching" decision for a title, so
 * a client asks instead of re-deriving it. When {@link resumable} is false the client shows Play;
 * otherwise {@link mediaType}/{@link season}/{@link episode} identify what to play and {@link progress}
 * is the 0–100 seek position (0 = start of that episode).
 */
export interface ResumeTarget {
    resumable: boolean
    mediaType: ScrobbleMediaType // 'movie' | 'episode'
    tmdbId: number
    season: number // 0 for a movie
    episode: number // 0 for a movie
    progress: number // 0–100 seek position
    title: string | null
    reason: ResumeReason
}

/**
 * Builds the `/scrobble` media key for a title, matching the backend's scheme. Handy for a `GET
 * /scrobble/{mediaKey}` lookup when resuming a specific movie/episode.
 */
export function scrobbleMediaKey(ref: {
    mediaType: ScrobbleMediaType
    tmdbId: number
    season?: number
    episode?: number
}): string {
    return ref.mediaType === 'movie'
        ? `m${ref.tmdbId}`
        : `e${ref.tmdbId}-${ref.season ?? 0}-${ref.episode ?? 0}`
}

// ---- Follow + notifications (release tracking) ----
//
// A self-hosted OMSS backend (e.g. gatearr) can also let a frontend "follow" a title to be notified of
// new releases. Follows are stored locally and keyed by TMDB identity — `m{tmdbId}` for a movie,
// `s{tmdbId}` for a show (distinct from the scrobble episode key). A background scan writes
// notifications when a followed movie/episode gains a file (`available`) or appears on the upstream
// calendar (`upcoming`); the UI's bell reads them. Served under `/follow` + `/notifications`; backends
// that don't implement it simply 404 these routes.

export type FollowMediaType = 'movie' | 'show'

/** Body of `POST /follow`. `mediaType` accepts `tv` as an alias for `show`. */
export interface FollowRequest {
    mediaType: 'movie' | 'tv' | 'show'
    tmdbId: number
    title?: string
}

/** One followed title. */
export interface FollowState {
    mediaKey: string // "m{tmdb}" | "s{tmdb}"
    mediaType: FollowMediaType
    tmdbId: number
    title?: string | null
    createdAt: number // unix seconds
    availableWatermark: number // unix seconds; only newer files/releases notify
}

/** Acknowledgement returned by `POST /follow`. `created` is false when it was already followed. */
export interface FollowAck {
    mediaKey: string
    mediaType: FollowMediaType
    tmdbId: number
    title: string | null
    following: boolean
    created: boolean
}

/** `GET /follow` — every followed title, newest-first. */
export interface FollowListResponse {
    count: number
    data: FollowState[]
}

export type NotificationKind = 'available' | 'upcoming'

/** One release notification for a followed title. */
export interface NotificationItem {
    id: number
    dedupeKey: string
    mediaKey: string
    tmdbId: number
    mediaType: FollowMediaType
    kind: NotificationKind
    title: string
    message: string
    season: number // episodes; 0 for a movie
    episode: number // episodes; 0 for a movie
    createdAt: number // unix seconds
    readAt: number | null // unix seconds; null = unread
}

/** `GET /notifications` — newest-first, DataTables-style paging counters. */
export interface NotificationListResponse {
    recordsTotal: number
    recordsFiltered: number
    data: NotificationItem[]
}

/** `GET /notifications/count` — the unread count for the bell badge. */
export interface NotificationCount {
    unread: number
}

/** Builds the `/follow` media key for a title, matching the backend's scheme. */
export function followMediaKey(ref: { mediaType: 'movie' | 'tv' | 'show'; tmdbId: number }): string {
    return ref.mediaType === 'movie' ? `m${ref.tmdbId}` : `s${ref.tmdbId}`
}
