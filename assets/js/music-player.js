(() => {
    const root = document.getElementById('fm-player');
    if (!root) return;

    const VIDEO_ID = root.dataset.video;
    // where the vocals come in (seconds); also where the loop restarts
    const START_AT = Number(root.dataset.start) || 0;
    const VOLUME = 12;
    const playBtn = document.getElementById('fm-play');
    const muteBtn = document.getElementById('fm-mute');
    const disc = document.getElementById('fm-disc');
    const collapseBtn = document.getElementById('fm-collapse');

    let player = null;
    let ready = false;
    let wantPlay = true;
    let muted = false;
    let progressTimer = null;

    function loadApi() {
        if (window.YT && window.YT.Player) {
            createPlayer();
            return;
        }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof prev === 'function') prev();
            createPlayer();
        };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
    }

    function createPlayer() {
        player = new YT.Player('fm-yt', {
            host: 'https://www.youtube-nocookie.com',
            videoId: VIDEO_ID,
            width: 200,
            height: 200,
            playerVars: {
                autoplay: 1,
                start: START_AT,
                controls: 0,
                disablekb: 1,
                playsinline: 1,
                rel: 0,
            },
            events: {
                onReady: () => {
                    ready = true;
                    player.setVolume(VOLUME);
                    if (muted) player.mute();
                    if (wantPlay) player.playVideo();
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.ENDED) {
                        player.seekTo(START_AT, true);
                        player.playVideo();
                        return;
                    }
                    root.classList.toggle('loading', e.data === YT.PlayerState.BUFFERING);
                    setPlaying(e.data === YT.PlayerState.PLAYING);
                },
                onError: () => {
                    wantPlay = false;
                    root.classList.remove('loading');
                    root.classList.add('fm-error');
                    setPlaying(false);
                },
            },
        });
    }

    function setPlaying(on) {
        root.classList.toggle('playing', on);
        const label = on ? 'Pause music' : 'Play music';
        playBtn.setAttribute('aria-label', label);
        disc.setAttribute('aria-label', label);
        clearInterval(progressTimer);
        if (on) progressTimer = setInterval(updateProgress, 500);
    }

    function updateProgress() {
        if (!ready) return;
        const d = player.getDuration();
        if (d > 0) root.style.setProperty('--fm-progress', (player.getCurrentTime() / d).toFixed(4));
    }

    function togglePlay() {
        wantPlay = !root.classList.contains('playing');
        root.classList.remove('fm-error');
        if (!player) {
            if (wantPlay) {
                root.classList.add('loading');
                loadApi();
            }
            return;
        }
        if (!ready) {
            root.classList.toggle('loading', wantPlay);
            return;
        }
        if (wantPlay) player.playVideo();
        else player.pauseVideo();
    }

    function toggleMute() {
        muted = !muted;
        root.classList.toggle('muted', muted);
        muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
        if (ready) {
            if (muted) player.mute();
            else player.unMute();
        }
    }

    function setCollapsed(collapsed) {
        root.classList.toggle('collapsed', collapsed);
        collapseBtn.setAttribute('aria-expanded', String(!collapsed));
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expand music player' : 'Collapse music player');
    }

    playBtn.addEventListener('click', togglePlay);
    disc.addEventListener('click', togglePlay);
    muteBtn.addEventListener('click', toggleMute);
    collapseBtn.addEventListener('click', () => {
        const collapsed = !root.classList.contains('collapsed');
        setCollapsed(collapsed);
        try { localStorage.setItem('fm-collapsed', collapsed ? '1' : '0'); } catch (_) { /* storage unavailable */ }
    });

    // Default to playing. Browsers block sound until the visitor interacts with the page,
    // so if the autoplay attempt is refused, start on their first click, tap or key press.
    function startOnGesture(e) {
        if (root.contains(e.target)) return;
        document.removeEventListener('pointerdown', startOnGesture, true);
        document.removeEventListener('keydown', startOnGesture, true);
        if (wantPlay && ready && !root.classList.contains('playing')) player.playVideo();
    }
    document.addEventListener('pointerdown', startOnGesture, true);
    document.addEventListener('keydown', startOnGesture, true);
    root.classList.add('loading');
    loadApi();

    let saved = null;
    try { saved = localStorage.getItem('fm-collapsed'); } catch (_) { /* storage unavailable */ }
    setCollapsed(saved === null ? window.matchMedia('(max-width: 600px)').matches : saved === '1');
})();
