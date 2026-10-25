(() => {
    const root = document.getElementById('fm-player');
    if (!root) return;

    const VIDEO_ID = root.dataset.video;
    const VOLUME = 20;
    const playBtn = document.getElementById('fm-play');
    const muteBtn = document.getElementById('fm-mute');
    const disc = document.getElementById('fm-disc');
    const collapseBtn = document.getElementById('fm-collapse');

    let player = null;
    let ready = false;
    let wantPlay = false;
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
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                loop: 1,
                playlist: VIDEO_ID,
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
        wantPlay = !wantPlay;
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

    let saved = null;
    try { saved = localStorage.getItem('fm-collapsed'); } catch (_) { /* storage unavailable */ }
    setCollapsed(saved === null ? window.matchMedia('(max-width: 600px)').matches : saved === '1');
})();
