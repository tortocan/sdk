interface HealthResponse {
    name: string;
    version: string;
    status: 'operational' | 'degraded' | 'maintenance' | 'offline';
    endpoints?: {
        movie?: string;
        tv?: string;
        proxy?: string;
    };
    spec: 'omss';
    note?: string;
}
interface AudioTrack {
    language: string;
    label: string;
}
type SourceType = 'hls' | 'dash' | 'http' | 'mp4' | 'mkv' | 'webm';
interface Provider {
    id: string;
    name: string;
}
interface Source {
    url: string;
    type: SourceType;
    quality: string;
    audioTracks: AudioTrack[];
    provider: Provider;
}
type SubtitleFormat = 'vtt' | 'srt' | 'ass' | 'ssa';
interface Subtitle {
    url: string;
    label: string;
    format: SubtitleFormat;
}
type DiagnosticSeverity = 'info' | 'warning' | 'error';
interface Diagnostic {
    code: 'QUALITY_INFERRED' | 'LANGUAGE_INFERRED' | 'TYPE_INFERRED' | 'SUBTITLE_LABEL_INFERRED' | 'PROVIDER_ERROR' | 'PARTIAL_SCRAPE';
    message: string;
    field?: string;
    severity: DiagnosticSeverity;
}
interface SourceResponse {
    responseId: string;
    expiresAt: string;
    sources: Source[];
    subtitles: Subtitle[];
    diagnostics: Diagnostic[];
}
interface RefreshResponse {
    status: 'OK';
}
type ErrorCode = 'INVALID_TMDB_ID' | 'INVALID_PARAMETER' | 'MISSING_PARAMETER' | 'INVALID_SEASON' | 'INVALID_EPISODE' | 'INVALID_RESPONSE_ID' | 'RESPONSE_ID_NOT_FOUND' | 'NO_SOURCES_AVAILABLE' | 'ENDPOINT_NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'INTERNAL_ERROR' | 'UNSUPPORTED_MEDIA_TYPE';
interface ErrorObject {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
}
interface ErrorResponse {
    error: ErrorObject;
    traceId: string;
}
/**
 * Generic wrapper shape returned by OmssClient methods.
 */
type OmssResult<T> = {
    data: T;
    error: null;
} | {
    data: null;
    error: ErrorResponse;
};
type ScrobbleAction = 'start' | 'pause' | 'stop';
type ScrobbleMediaType = 'movie' | 'episode';
type ScrobbleStatus = 'started' | 'paused' | 'stopped';
/** Body of `POST /scrobble`. `season`/`episode` are required for an episode, ignored for a movie. */
interface ScrobbleRequest {
    mediaType: ScrobbleMediaType;
    tmdbId: number;
    season?: number;
    episode?: number;
    progress: number;
    action: ScrobbleAction;
    title?: string;
}
/** The stored playback state for one title. */
interface ScrobbleState {
    mediaKey: string;
    mediaType: ScrobbleMediaType;
    tmdbId: number;
    season: number;
    episode: number;
    progress: number;
    status: ScrobbleStatus;
    watched: boolean;
    watchedAt: number;
    updatedAt: number;
    title?: string | null;
}
/** Acknowledgement returned by `POST /scrobble` (the upserted row's live state). */
interface ScrobbleAck {
    mediaKey: string;
    status: ScrobbleStatus;
    progress: number;
    watched: boolean;
    watchedAt: number;
    updatedAt: number;
}
/** `GET /scrobble/playback` — resume / "continue watching": started-but-unfinished titles. */
interface ScrobblePlaybackResponse {
    count: number;
    data: ScrobbleState[];
}
/** `GET /scrobble/history` — watched titles, DataTables-style paging counters. */
interface ScrobbleHistoryResponse {
    recordsTotal: number;
    recordsFiltered: number;
    data: ScrobbleState[];
}
/** `GET /scrobble/show/{tmdbId}` — a show's scrobbled episodes, ordered by season then episode. */
interface ScrobbleShowResponse {
    count: number;
    data: ScrobbleState[];
}
type ResumeReason = 'in_progress' | 'next_up' | 'rewatch' | 'none';
/**
 * `GET /scrobble/resume/{type}/{tmdbId}` — the backend's "continue watching" decision for a title, so
 * a client asks instead of re-deriving it. When {@link resumable} is false the client shows Play;
 * otherwise {@link mediaType}/{@link season}/{@link episode} identify what to play and {@link progress}
 * is the 0–100 seek position (0 = start of that episode).
 */
interface ResumeTarget {
    resumable: boolean;
    mediaType: ScrobbleMediaType;
    tmdbId: number;
    season: number;
    episode: number;
    progress: number;
    title: string | null;
    reason: ResumeReason;
}
/**
 * Builds the `/scrobble` media key for a title, matching the backend's scheme. Handy for a `GET
 * /scrobble/{mediaKey}` lookup when resuming a specific movie/episode.
 */
declare function scrobbleMediaKey(ref: {
    mediaType: ScrobbleMediaType;
    tmdbId: number;
    season?: number;
    episode?: number;
}): string;
type FollowMediaType = 'movie' | 'show';
/** Body of `POST /follow`. `mediaType` accepts `tv` as an alias for `show`. */
interface FollowRequest {
    mediaType: 'movie' | 'tv' | 'show';
    tmdbId: number;
    title?: string;
}
/** One followed title. */
interface FollowState {
    mediaKey: string;
    mediaType: FollowMediaType;
    tmdbId: number;
    title?: string | null;
    createdAt: number;
    availableWatermark: number;
}
/** Acknowledgement returned by `POST /follow`. `created` is false when it was already followed. */
interface FollowAck {
    mediaKey: string;
    mediaType: FollowMediaType;
    tmdbId: number;
    title: string | null;
    following: boolean;
    created: boolean;
}
/** `GET /follow` — every followed title, newest-first. */
interface FollowListResponse {
    count: number;
    data: FollowState[];
}
type NotificationKind = 'available' | 'upcoming';
/** One release notification for a followed title. */
interface NotificationItem {
    id: number;
    dedupeKey: string;
    mediaKey: string;
    tmdbId: number;
    mediaType: FollowMediaType;
    kind: NotificationKind;
    title: string;
    message: string;
    season: number;
    episode: number;
    createdAt: number;
    readAt: number | null;
}
/** `GET /notifications` — newest-first, DataTables-style paging counters. */
interface NotificationListResponse {
    recordsTotal: number;
    recordsFiltered: number;
    data: NotificationItem[];
}
/** `GET /notifications/count` — the unread count for the bell badge. */
interface NotificationCount {
    unread: number;
}
/** Builds the `/follow` media key for a title, matching the backend's scheme. */
declare function followMediaKey(ref: {
    mediaType: 'movie' | 'tv' | 'show';
    tmdbId: number;
}): string;
/** How a title is offered on a provider. The Watch extension currently emits `flatrate`. */
type WatchMonetization = 'flatrate' | 'rent' | 'buy' | 'ads' | 'cinema';
/**
 * The provider on a watch offer. `id` is a TMDB watch-provider id when the backend matched it
 * server-side, else null — in which case the client matches the offer to its own provider list by `name`.
 */
interface WatchOfferProvider {
    id: number | null;
    name: string;
}
/** One provider's offer for a title, with a deep-link to that provider's page for the title. */
interface WatchOffer {
    provider: WatchOfferProvider;
    monetizationType: WatchMonetization;
    url: string;
}
/** `GET /watch/offers` — per-provider streaming deep-links for a title in a region. */
interface WatchOffersResponse {
    type: 'movie' | 'tv';
    tmdbId: number;
    region: string;
    data: WatchOffer[];
}

interface OmssClientConfig {
    baseUrl: string;
    fetchFn?: typeof fetch;
    getDefaultHeaders?: () => HeadersInit;
}
declare class OmssClient {
    private baseUrl;
    private fetchFn;
    private getDefaultHeaders?;
    constructor(config: OmssClientConfig);
    static create(config: OmssClientConfig): OmssClient;
    private requestJson;
    /**
     * GET /
     */
    getHealth(): Promise<OmssResult<HealthResponse>>;
    /**
     * GET /v1
     */
    getVersion(): Promise<OmssResult<HealthResponse>>;
    /**
     * GET /v1/health
     */
    getHealthStatus(): Promise<OmssResult<HealthResponse>>;
    /**
     * GET /v1/movies/{id}
     * TMDB movie ID as string (numeric).
     */
    getMovie(id: string): Promise<OmssResult<SourceResponse>>;
    /**
     * GET /v1/tv/{id}/seasons/{s}/episodes/{e}
     */
    getTvEpisode(id: string, season: number, episode: number): Promise<OmssResult<SourceResponse>>;
    /**
     * GET /v1/refresh/{responseId}
     */
    refreshSource(responseId: string): Promise<OmssResult<RefreshResponse>>;
    /**
     * POST /scrobble — report playback for one title (start/pause/stop + a 0–100 progress) so the
     * backend can offer resume and a watched list. Upserts one row keyed by TMDB identity.
     */
    scrobble(req: ScrobbleRequest): Promise<OmssResult<ScrobbleAck>>;
    /**
     * GET /scrobble/playback — resume / "continue watching": titles started but not finished,
     * most-recently-played first. Optionally narrowed to movies or episodes.
     */
    getScrobblePlayback(type?: ScrobbleMediaType): Promise<OmssResult<ScrobblePlaybackResponse>>;
    /**
     * GET /scrobble/history — watched titles, newest first, with DataTables-style paging counters.
     */
    getScrobbleHistory(opts?: {
        type?: ScrobbleMediaType;
        start?: number;
        length?: number;
    }): Promise<OmssResult<ScrobbleHistoryResponse>>;
    /**
     * GET /scrobble/{mediaKey} — the stored playback state for one title, or an error if it was never
     * scrobbled. Pass a key from {@link scrobbleMediaKey}.
     */
    getScrobbleState(mediaKey: string): Promise<OmssResult<ScrobbleState>>;
    /**
     * Convenience: resolve a movie/episode reference to its stored playback state (or null when never
     * scrobbled), so a player can seek to the resume point on load without hand-building the key.
     */
    getScrobbleFor(ref: {
        mediaType: ScrobbleMediaType;
        tmdbId: number;
        season?: number;
        episode?: number;
    }): Promise<ScrobbleState | null>;
    /**
     * GET /scrobble/show/{tmdbId} — a show's scrobbled episodes (by the show's tmdb id), ordered by
     * season then episode. Use to compute a show's resume point (in-progress episode, or the next
     * after the latest watched).
     */
    getScrobbleShow(showTmdbId: number): Promise<OmssResult<ScrobbleShowResponse>>;
    /**
     * GET /scrobble/resume/{type}/{tmdbId} — the backend's continue-watching decision for a title.
     * Ask this instead of re-deriving resume client-side: it returns which movie/episode to play, the
     * seek position, and whether anything is resumable at all (else the client shows Play).
     */
    getResume(type: 'movie' | 'tv', tmdbId: number): Promise<OmssResult<ResumeTarget>>;
    /** DELETE /scrobble/{mediaKey} — remove one title's stored playback state. */
    deleteScrobble(mediaKey: string): Promise<OmssResult<null>>;
    /** DELETE /scrobble — clear ALL scrobble state (watch history + resume points). */
    clearScrobbles(): Promise<OmssResult<{
        deleted: number;
    }>>;
    /**
     * POST /follow — follow a title (movie or show, keyed by TMDB identity) to be notified of new
     * releases. Upserts; `created` is false when it was already followed.
     */
    follow(req: FollowRequest): Promise<OmssResult<FollowAck>>;
    /** GET /follow — every followed title, newest-first. */
    getFollows(): Promise<OmssResult<FollowListResponse>>;
    /** GET /follow/{mediaKey} — one follow ("m{tmdb}" | "s{tmdb}"), or an error if not followed. */
    getFollow(mediaKey: string): Promise<OmssResult<FollowState>>;
    /** Convenience: is this title currently followed? */
    isFollowing(ref: {
        mediaType: 'movie' | 'tv' | 'show';
        tmdbId: number;
    }): Promise<boolean>;
    /** DELETE /follow/{mediaKey} — unfollow one title. */
    unfollow(mediaKey: string): Promise<OmssResult<null>>;
    /** DELETE /follow — unfollow everything. */
    clearFollows(): Promise<OmssResult<{
        deleted: number;
    }>>;
    /** GET /notifications — release notifications, newest-first, with DataTables-style paging. */
    getNotifications(opts?: {
        unreadOnly?: boolean;
        start?: number;
        length?: number;
    }): Promise<OmssResult<NotificationListResponse>>;
    /** GET /notifications/count — the unread count for the bell badge. */
    getNotificationCount(): Promise<OmssResult<NotificationCount>>;
    /** POST /notifications/read — mark all unread notifications read; returns the count updated. */
    markNotificationsRead(): Promise<OmssResult<{
        updated: number;
    }>>;
    /** POST /notifications/{id}/read — mark one notification read. */
    markNotificationRead(id: number): Promise<OmssResult<null>>;
    /** DELETE /notifications/{id} — remove one notification. */
    deleteNotification(id: number): Promise<OmssResult<null>>;
    /** DELETE /notifications — clear all notifications. */
    clearNotifications(): Promise<OmssResult<{
        deleted: number;
    }>>;
    /**
     * GET /watch/offers — per-provider streaming deep-links (JustWatch-backed) for a title in a region.
     * `title` is the search seed; the backend disambiguates the result against `tmdbId`. Subscription
     * (flatrate) offers; an empty `data` array means unavailable/failed, so the caller can fall back to
     * its own aggregate "where to watch" link. Offers whose `provider.id` is null are matched by name.
     */
    getWatchOffers(type: 'movie' | 'tv', tmdbId: number, region: string, title: string): Promise<OmssResult<WatchOffersResponse>>;
    /**
     * Utils Function to set the base URL of the API client after instantiation.
     * Useful when the base URL is not known at the time of client creation.
     */
    setBaseUrl(newBaseUrl: string): void;
    /**
     * Utils Function to get the current base URL of the API client.
     */
    getBaseUrl(): string;
}
declare const createOmssClient: (config: OmssClientConfig) => OmssClient;

export { type AudioTrack, type Diagnostic, type DiagnosticSeverity, type ErrorCode, type ErrorObject, type ErrorResponse, type FollowAck, type FollowListResponse, type FollowMediaType, type FollowRequest, type FollowState, type HealthResponse, type NotificationCount, type NotificationItem, type NotificationKind, type NotificationListResponse, OmssClient, type OmssClientConfig, type OmssResult, type Provider, type RefreshResponse, type ResumeReason, type ResumeTarget, type ScrobbleAck, type ScrobbleAction, type ScrobbleHistoryResponse, type ScrobbleMediaType, type ScrobblePlaybackResponse, type ScrobbleRequest, type ScrobbleShowResponse, type ScrobbleState, type ScrobbleStatus, type Source, type SourceResponse, type SourceType, type Subtitle, type SubtitleFormat, type WatchMonetization, type WatchOffer, type WatchOfferProvider, type WatchOffersResponse, createOmssClient, followMediaKey, scrobbleMediaKey };
