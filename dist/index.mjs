// src/types.ts
function scrobbleMediaKey(ref) {
  var _a, _b;
  return ref.mediaType === "movie" ? `m${ref.tmdbId}` : `e${ref.tmdbId}-${(_a = ref.season) != null ? _a : 0}-${(_b = ref.episode) != null ? _b : 0}`;
}

// src/client.ts
var OmssClient = class _OmssClient {
  constructor(config) {
    var _a;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchFn = (_a = config.fetchFn) != null ? _a : fetch.bind(globalThis);
    this.getDefaultHeaders = config.getDefaultHeaders;
  }
  static create(config) {
    return new _OmssClient(config);
  }
  async requestJson(path, init) {
    var _a, _b, _c;
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: "application/json",
      ...this.getDefaultHeaders ? this.getDefaultHeaders() : {},
      ...(_a = init == null ? void 0 : init.headers) != null ? _a : {}
    };
    let res;
    try {
      res = await this.fetchFn(url, { ...init, headers });
    } catch (e) {
      const error2 = {
        error: {
          code: "INTERNAL_ERROR",
          message: (_b = e.message) != null ? _b : "Network error"
        },
        traceId: "network-error"
      };
      return { data: null, error: error2 };
    }
    const status = res.status;
    let body = null;
    try {
      if ((_c = res.headers.get("Content-Type")) == null ? void 0 : _c.includes("application/json")) {
        body = await res.json();
      } else {
        body = await res.text();
      }
    } catch {
    }
    if (res.ok) {
      return { data: body, error: null };
    }
    const error = body;
    return { data: null, error };
  }
  // ---- OMSS operations ----
  /**
   * GET /
   */
  getHealth() {
    return this.requestJson("/");
  }
  /**
   * GET /v1
   */
  getVersion() {
    return this.requestJson("/v1");
  }
  /**
   * GET /v1/health
   */
  getHealthStatus() {
    return this.requestJson("/v1/health");
  }
  /**
   * GET /v1/movies/{id}
   * TMDB movie ID as string (numeric).
   */
  getMovie(id) {
    return this.requestJson(`/v1/movies/${encodeURIComponent(id)}`);
  }
  /**
   * GET /v1/tv/{id}/seasons/{s}/episodes/{e}
   */
  getTvEpisode(id, season, episode) {
    const path = `/v1/tv/${encodeURIComponent(id)}/seasons/${season}/episodes/${episode}`;
    return this.requestJson(path);
  }
  /**
   * GET /v1/refresh/{responseId}
   */
  refreshSource(responseId) {
    return this.requestJson(`/v1/refresh/${encodeURIComponent(responseId)}`);
  }
  // ---- Scrobble (optional local playback-progress extension, served under /scrobble) ----
  /**
   * POST /scrobble — report playback for one title (start/pause/stop + a 0–100 progress) so the
   * backend can offer resume and a watched list. Upserts one row keyed by TMDB identity.
   */
  scrobble(req) {
    return this.requestJson("/scrobble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
  }
  /**
   * GET /scrobble/playback — resume / "continue watching": titles started but not finished,
   * most-recently-played first. Optionally narrowed to movies or episodes.
   */
  getScrobblePlayback(type) {
    const q = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.requestJson(`/scrobble/playback${q}`);
  }
  /**
   * GET /scrobble/history — watched titles, newest first, with DataTables-style paging counters.
   */
  getScrobbleHistory(opts) {
    const p = new URLSearchParams();
    if (opts == null ? void 0 : opts.type) p.set("type", opts.type);
    if ((opts == null ? void 0 : opts.start) != null) p.set("start", String(opts.start));
    if ((opts == null ? void 0 : opts.length) != null) p.set("length", String(opts.length));
    const q = p.toString() ? `?${p.toString()}` : "";
    return this.requestJson(`/scrobble/history${q}`);
  }
  /**
   * GET /scrobble/{mediaKey} — the stored playback state for one title, or an error if it was never
   * scrobbled. Pass a key from {@link scrobbleMediaKey}.
   */
  getScrobbleState(mediaKey) {
    return this.requestJson(`/scrobble/${encodeURIComponent(mediaKey)}`);
  }
  /**
   * Convenience: resolve a movie/episode reference to its stored playback state (or null when never
   * scrobbled), so a player can seek to the resume point on load without hand-building the key.
   */
  async getScrobbleFor(ref) {
    const { data } = await this.getScrobbleState(scrobbleMediaKey(ref));
    return data != null ? data : null;
  }
  /**
   * GET /scrobble/show/{tmdbId} — a show's scrobbled episodes (by the show's tmdb id), ordered by
   * season then episode. Use to compute a show's resume point (in-progress episode, or the next
   * after the latest watched).
   */
  getScrobbleShow(showTmdbId) {
    return this.requestJson(`/scrobble/show/${showTmdbId}`);
  }
  /**
   * GET /scrobble/resume/{type}/{tmdbId} — the backend's continue-watching decision for a title.
   * Ask this instead of re-deriving resume client-side: it returns which movie/episode to play, the
   * seek position, and whether anything is resumable at all (else the client shows Play).
   */
  getResume(type, tmdbId) {
    return this.requestJson(`/scrobble/resume/${type}/${tmdbId}`);
  }
  /** DELETE /scrobble/{mediaKey} — remove one title's stored playback state. */
  deleteScrobble(mediaKey) {
    return this.requestJson(`/scrobble/${encodeURIComponent(mediaKey)}`, { method: "DELETE" });
  }
  /** DELETE /scrobble — clear ALL scrobble state (watch history + resume points). */
  clearScrobbles() {
    return this.requestJson("/scrobble", { method: "DELETE" });
  }
  /**
   * Utils Function to set the base URL of the API client after instantiation.
   * Useful when the base URL is not known at the time of client creation.
   */
  setBaseUrl(newBaseUrl) {
    this.baseUrl = newBaseUrl.replace(/\/+$/, "");
  }
  /** 
   * Utils Function to get the current base URL of the API client.
   */
  getBaseUrl() {
    return this.baseUrl;
  }
};
var createOmssClient = (config) => OmssClient.create(config);
export {
  OmssClient,
  createOmssClient,
  scrobbleMediaKey
};
