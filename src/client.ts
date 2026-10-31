import type {
    HealthResponse,
    SourceResponse,
    RefreshResponse,
    ErrorResponse,
    OmssResult,
    ScrobbleRequest,
    ScrobbleAck,
    ScrobbleState,
    ScrobbleMediaType,
    ScrobblePlaybackResponse,
    ScrobbleHistoryResponse,
    ScrobbleShowResponse,
    ResumeTarget,
} from './types'
import { scrobbleMediaKey } from './types'

export interface OmssClientConfig {
    baseUrl: string
    fetchFn?: typeof fetch
    getDefaultHeaders?: () => HeadersInit
}

export class OmssClient {
    private baseUrl: string
    private fetchFn: typeof fetch
    private getDefaultHeaders?: () => HeadersInit

    constructor(config: OmssClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, '')
        this.fetchFn = config.fetchFn ?? fetch.bind(globalThis)
        this.getDefaultHeaders = config.getDefaultHeaders
    }

    static create(config: OmssClientConfig) {
        return new OmssClient(config)
    }

    private async requestJson<T>(path: string, init?: RequestInit): Promise<OmssResult<T>> {
        const url = `${this.baseUrl}${path}`
        const headers: HeadersInit = {
            Accept: 'application/json',
            ...(this.getDefaultHeaders ? this.getDefaultHeaders() : {}),
            ...(init?.headers ?? {}),
        }

        let res: Response
        try {
            res = await this.fetchFn(url, { ...init, headers })
        } catch (e) {
            // Network error, synthesize an ErrorResponse-like object
            const error: ErrorResponse = {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: (e as Error).message ?? 'Network error',
                },
                traceId: 'network-error',
            }
            return { data: null, error }
        }

        const status = res.status

        // Try parse JSON; if it fails, treat as generic error/success without body
        let body: unknown = null
        try {
            if (res.headers.get('Content-Type')?.includes('application/json')) {
                body = await res.json()
            } else {
                body = await res.text()
            }
        } catch {
            // ignore parse errors
        }

        if (res.ok) {
            return { data: body as T, error: null }
        }

        const error = body as ErrorResponse
        return { data: null, error }
    }

    // ---- OMSS operations ----

    /**
     * GET /
     */
    getHealth() {
        return this.requestJson<HealthResponse>('/')
    }

    /**
     * GET /v1
     */
    getVersion() {
        return this.requestJson<HealthResponse>('/v1')
    }

    /**
     * GET /v1/health
     */
    getHealthStatus() {
        return this.requestJson<HealthResponse>('/v1/health')
    }

    /**
     * GET /v1/movies/{id}
     * TMDB movie ID as string (numeric).
     */
    getMovie(id: string) {
        return this.requestJson<SourceResponse>(`/v1/movies/${encodeURIComponent(id)}`)
    }

    /**
     * GET /v1/tv/{id}/seasons/{s}/episodes/{e}
     */
    getTvEpisode(id: string, season: number, episode: number) {
        const path = `/v1/tv/${encodeURIComponent(id)}/seasons/${season}/episodes/${episode}`
        return this.requestJson<SourceResponse>(path)
    }

    /**
     * GET /v1/refresh/{responseId}
     */
    refreshSource(responseId: string) {
        return this.requestJson<RefreshResponse>(`/v1/refresh/${encodeURIComponent(responseId)}`)
    }

    // ---- Scrobble (optional local playback-progress extension, served under /scrobble) ----

    /**
     * POST /scrobble — report playback for one title (start/pause/stop + a 0–100 progress) so the
     * backend can offer resume and a watched list. Upserts one row keyed by TMDB identity.
     */
    scrobble(req: ScrobbleRequest) {
        return this.requestJson<ScrobbleAck>('/scrobble', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        })
    }

    /**
     * GET /scrobble/playback — resume / "continue watching": titles started but not finished,
     * most-recently-played first. Optionally narrowed to movies or episodes.
     */
    getScrobblePlayback(type?: ScrobbleMediaType) {
        const q = type ? `?type=${encodeURIComponent(type)}` : ''
        return this.requestJson<ScrobblePlaybackResponse>(`/scrobble/playback${q}`)
    }

    /**
     * GET /scrobble/history — watched titles, newest first, with DataTables-style paging counters.
     */
    getScrobbleHistory(opts?: { type?: ScrobbleMediaType; start?: number; length?: number }) {
        const p = new URLSearchParams()
        if (opts?.type) p.set('type', opts.type)
        if (opts?.start != null) p.set('start', String(opts.start))
        if (opts?.length != null) p.set('length', String(opts.length))
        const q = p.toString() ? `?${p.toString()}` : ''
        return this.requestJson<ScrobbleHistoryResponse>(`/scrobble/history${q}`)
    }

    /**
     * GET /scrobble/{mediaKey} — the stored playback state for one title, or an error if it was never
     * scrobbled. Pass a key from {@link scrobbleMediaKey}.
     */
    getScrobbleState(mediaKey: string) {
        return this.requestJson<ScrobbleState>(`/scrobble/${encodeURIComponent(mediaKey)}`)
    }

    /**
     * Convenience: resolve a movie/episode reference to its stored playback state (or null when never
     * scrobbled), so a player can seek to the resume point on load without hand-building the key.
     */
    async getScrobbleFor(ref: {
        mediaType: ScrobbleMediaType
        tmdbId: number
        season?: number
        episode?: number
    }): Promise<ScrobbleState | null> {
        const { data } = await this.getScrobbleState(scrobbleMediaKey(ref))
        return data ?? null
    }

    /**
     * GET /scrobble/show/{tmdbId} — a show's scrobbled episodes (by the show's tmdb id), ordered by
     * season then episode. Use to compute a show's resume point (in-progress episode, or the next
     * after the latest watched).
     */
    getScrobbleShow(showTmdbId: number) {
        return this.requestJson<ScrobbleShowResponse>(`/scrobble/show/${showTmdbId}`)
    }

    /**
     * GET /scrobble/resume/{type}/{tmdbId} — the backend's continue-watching decision for a title.
     * Ask this instead of re-deriving resume client-side: it returns which movie/episode to play, the
     * seek position, and whether anything is resumable at all (else the client shows Play).
     */
    getResume(type: 'movie' | 'tv', tmdbId: number) {
        return this.requestJson<ResumeTarget>(`/scrobble/resume/${type}/${tmdbId}`)
    }

    /** DELETE /scrobble/{mediaKey} — remove one title's stored playback state. */
    deleteScrobble(mediaKey: string) {
        return this.requestJson<null>(`/scrobble/${encodeURIComponent(mediaKey)}`, { method: 'DELETE' })
    }

    /** DELETE /scrobble — clear ALL scrobble state (watch history + resume points). */
    clearScrobbles() {
        return this.requestJson<{ deleted: number }>('/scrobble', { method: 'DELETE' })
    }

    /**
     * Utils Function to set the base URL of the API client after instantiation.
     * Useful when the base URL is not known at the time of client creation.
     */
    setBaseUrl(newBaseUrl: string) {
        this.baseUrl = newBaseUrl.replace(/\/+$/, '')
    }
    
    /** 
     * Utils Function to get the current base URL of the API client.
     */
    getBaseUrl() {
        return this.baseUrl
    }
}

// Factory
export const createOmssClient = (config: OmssClientConfig) => OmssClient.create(config)

export type { OmssResult } from './types'
