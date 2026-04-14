/* ============================================
   TV KIOSK - APP.JS v7.0 (Album, Offline, Smart Playback)
   ============================================ */

(function () {
    'use strict';

    const CONFIG = {
        SLIDE_INTERVAL: 10000,      
        DATA_REFRESH: 120000, 
        CLOCK_REFRESH: 1000,
        PROGRESS_STEP: 50,
        TICKER_CYCLE: 6000,
        TICKER_SCROLL_SPEED: 70,
        WEATHER_REFRESH: 600000,
        WEATHER_CITY: 'Sultangazi',
        WEATHER_LAT: 41.1075,
        WEATHER_LON: 28.8617,
        NEXT_PREVIEW_SHOW: 3000,
    };

    const dynamicStyle = document.createElement('style');
    dynamicStyle.innerHTML = `
        .slide-media { transition: width 1s cubic-bezier(0.25, 1, 0.5, 1) !important; z-index: 50; background: #000; }
        .slide-media::after { transition: opacity 0.5s ease; }
        .fullscreen-media { width: 100% !important; }
        .fullscreen-media::after { opacity: 0 !important; }
        .slide-text { transition: opacity 0.5s ease; }
        .text-hidden { opacity: 0 !important; }
    `;
    document.head.appendChild(dynamicStyle);

    window.ytApiReady = false;
    window.ytPlayers = {};

    window.onYouTubeIframeAPIReady = function () {
        window.ytApiReady = true;
        initYouTubePlayers();
    };

    const ytScript = document.createElement('script');
    ytScript.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag) firstScriptTag.parentNode.insertBefore(ytScript, firstScriptTag);
    else document.head.appendChild(ytScript);

    const CATEGORY_MAP = {
        'duyuru': { icon: '📋', class: 'cat-duyuru', label: 'Duyuru' }, 'etkinlik': { icon: '🎉', class: 'cat-etkinlik', label: 'Etkinlik' },
        'sinav': { icon: '📝', class: 'cat-sinav', label: 'Sınav' }, 'sınav': { icon: '📝', class: 'cat-sinav', label: 'Sınav' },
        'onemli': { icon: '🔴', class: 'cat-onemli', label: 'Önemli' }, 'önemli': { icon: '🔴', class: 'cat-onemli', label: 'Önemli' },
        'acil': { icon: '🚨', class: 'cat-onemli', label: 'Acil' }, 'spor': { icon: '⚽', class: 'cat-etkinlik', label: 'Spor' },
        'bilim': { icon: '🔬', class: 'cat-etkinlik', label: 'Bilim' }, 'teknoloji': { icon: '💻', class: 'cat-etkinlik', label: 'Teknoloji' },
        'toplantı': { icon: '👥', class: 'cat-duyuru', label: 'Toplantı' }, 'kutlama': { icon: '🎊', class: 'cat-etkinlik', label: 'Kutlama' },
    };
    const DEFAULT_CATEGORY = { icon: '📌', class: 'cat-default', label: 'Bilgi' };
    const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    let slides = [];
    let tickerItems = [];
    let currentSlideIndex = 0;
    let currentAlbumIndex = 0;
    
    let currentSlideTimeout = null;
    let progressTimer = null;
    let nextPreviewTimer = null;
    let fullscreenTriggerTimer = null;
    let fallbackTimer = null; 
    let currentDataString = null;
    const els = {};

    function cacheDom() {
        els.setupPrompt = document.getElementById('setup-prompt'); els.mainDisplay = document.getElementById('main-display');
        els.offlineBadge = document.getElementById('offline-badge'); els.schoolName = document.getElementById('school-name');
        els.schoolLogo = document.getElementById('school-logo'); els.defaultSchoolIcon = document.getElementById('default-school-icon');
        els.time = document.getElementById('time'); els.date = document.getElementById('date');
        els.slidesContainer = document.getElementById('slides-container'); els.slideDots = document.getElementById('slide-dots');
        els.slideCounter = document.getElementById('slide-counter'); els.tickerContent = document.getElementById('ticker-content');
        els.loadingSlide = document.getElementById('loading-slide'); els.weatherIcon = document.getElementById('weather-icon');
        els.weatherTemp = document.getElementById('weather-temp'); els.weatherDesc = document.getElementById('weather-desc');
        els.weatherCity = document.getElementById('weather-city'); els.nextPreview = document.getElementById('next-slide-preview');
        els.nextPreviewTitle = document.getElementById('next-preview-title');
    }

    function clearAllTimers() {
        if (currentSlideTimeout) clearTimeout(currentSlideTimeout);
        if (progressTimer) clearInterval(progressTimer);
        if (nextPreviewTimer) clearTimeout(nextPreviewTimer);
        if (fullscreenTriggerTimer) clearTimeout(fullscreenTriggerTimer);
        if (fallbackTimer) clearTimeout(fallbackTimer);
    }

    function destroyAllPlayers() {
        for (let idx in window.ytPlayers) {
            if (window.ytPlayers[idx] && typeof window.ytPlayers[idx].destroy === 'function') {
                try { window.ytPlayers[idx].destroy(); } catch (e) { }
            }
        }
        window.ytPlayers = {};
    }

    function applyAutoScaling() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
        document.documentElement.style.overflow = 'hidden'; document.body.style.width = '100vw'; document.body.style.height = '100vh';
        document.body.style.margin = '0'; document.body.style.padding = '0'; document.body.style.overflow = 'hidden';

        function setFixedCanvas(el) {
            if (!el) return;
            el.style.width = '1920px'; el.style.height = '1080px'; el.style.position = 'absolute';
            el.style.top = '50%'; el.style.left = '50%'; el.style.transformOrigin = 'center center';
        }
        setFixedCanvas(els.mainDisplay); setFixedCanvas(els.setupPrompt);

        function resizeKiosk() {
            const winW = window.innerWidth; const winH = window.innerHeight; const scale = Math.min(winW / 1920, winH / 1080);
            if (els.mainDisplay) els.mainDisplay.style.transform = `translate(-50%, -50%) scale(${scale})`;
            if (els.setupPrompt) els.setupPrompt.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
        window.addEventListener('resize', resizeKiosk); resizeKiosk();
    }

    function init() {
        cacheDom(); applyAutoScaling(); 
        if (!navigator.onLine && els.offlineBadge) els.offlineBadge.classList.remove('hidden');
        const magicId = new URLSearchParams(window.location.search).get('id');
        if (magicId) { runMagicBoot(magicId); return; }
        continueInit();
    }

    function runMagicBoot(sheetId) {
        let cleanId = sheetId;
        if (cleanId.includes('docs.google.com')) cleanId = cleanId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1];
        localStorage.setItem('kiosk_sheet_id', cleanId); localStorage.removeItem('kiosk_demo_mode');
        if (!navigator.onLine) { continueInit(); return; }
        if (els.loadingSlide) els.loadingSlide.querySelector('.slide-content').textContent = 'Sistem ayarları çekiliyor...';

        const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json;responseHandler:magicAppCallback&sheet=AYARLAR&headers=1`;
        let magicTimeout = setTimeout(() => { if (window.magicAppCallback) { delete window.magicAppCallback; continueInit(); } }, 8000);

        window.magicAppCallback = function(json) {
            clearTimeout(magicTimeout);
            try {
                let settings = {};
                json.table.rows.forEach(row => {
                    if (row.c && row.c[0] && row.c[1]) settings[(row.c[0].v || '').toString().replace(/\s+/g, '').toLowerCase()] = (row.c[1].v || '').toString().trim();
                });
                if (settings['okuladi'] || settings['okuladı']) localStorage.setItem('kiosk_school_name', settings['okuladi'] || settings['okuladı']);
                if (settings['scripturl'] || settings['appscripturl']) localStorage.setItem('kiosk_script_url', settings['scripturl'] || settings['appscripturl']);
                if (settings['logourl']) localStorage.setItem('kiosk_school_logo', settings['logourl']);
                if (settings['sifre'] || settings['yöneticişifresi']) localStorage.setItem('kiosk_admin_password', settings['sifre'] || settings['yöneticişifresi']);
                let city = settings['sehir'] || settings['şehir'];
                if (city) localStorage.setItem('kiosk_weather_city', city);
            } catch(e) {}
            delete window.magicAppCallback;
            if (window.history && window.history.replaceState) window.history.replaceState({}, document.title, window.location.protocol + "//" + window.location.host + window.location.pathname);
            continueInit();
        };
        const script = document.createElement('script'); script.src = url; script.onerror = () => { clearTimeout(magicTimeout); continueInit(); }; document.body.appendChild(script);
    }

    function continueInit() {
        const isDemo = new URLSearchParams(window.location.search).has('demo') || localStorage.getItem('kiosk_demo_mode') === 'true';
        if (isDemo) { startDemoMode(); return; }

        const sheetId = localStorage.getItem('kiosk_sheet_id');
        if (!sheetId) { els.setupPrompt.classList.remove('hidden'); els.mainDisplay.classList.add('hidden'); return; }

        const schoolName = localStorage.getItem('kiosk_school_name');
        if (schoolName) { els.schoolName.textContent = schoolName + ' Bilgi Ekranı'; document.title = schoolName + ' — Bilgi Ekranı'; }
        const schoolLogo = localStorage.getItem('kiosk_school_logo');
        if (schoolLogo && els.schoolLogo) { els.schoolLogo.src = schoolLogo; els.schoolLogo.style.display = 'block'; if (els.defaultSchoolIcon) els.defaultSchoolIcon.style.display = 'none'; }
        
        startClock(); fetchWeather(); fetchData(sheetId);
        setInterval(() => fetchData(sheetId), CONFIG.DATA_REFRESH);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);
    }

    function startDemoMode() { els.schoolName.textContent = 'Gazi MTAL'; startClock(); fetchFreeWeather(); processData([{ baslik: 'Örnek Duyuru', icerik: 'Sistem demo modunda çalışıyor.', kategori: 'duyuru', aktif: 'evet' }]); }
    function startClock() { updateClock(); setInterval(updateClock, CONFIG.CLOCK_REFRESH); }
    function updateClock() { const now = new Date(); els.time.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; els.date.textContent = `${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}, ${TR_DAYS[now.getDay()]}`; }
    function getCleanSheetId(sheetId) { if (sheetId.includes('docs.google.com')) return sheetId.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]; return sheetId; }

    function loadFromCache() {
        if (slides.length > 0) return;
        const cachedData = localStorage.getItem('cachedAnnouncements');
        if (cachedData) { try { processData(JSON.parse(cachedData)); } catch (e) { showError('Önbellek okunamadı. İnternet bekleniyor...'); } } 
        else { showError('İnternet bağlantısı yok ve cihaz hafızasında kayıtlı veri bulunamadı.'); }
    }

    function fetchData(sheetId) {
        if (!navigator.onLine) { loadFromCache(); return; }
        const id = getCleanSheetId(sheetId);
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetData&sheet=DUYURULAR&headers=1`;
        let fetchTimeout = setTimeout(() => { if (window.parseGoogleSheetData) { delete window.parseGoogleSheetData; loadFromCache(); } }, 8000);

        window.parseGoogleSheetData = function (json) {
            clearTimeout(fetchTimeout); 
            try {
                const resultData = [];
                json.table.rows.forEach(row => {
                    const rowObj = {};
                    json.table.cols.forEach((col, index) => {
                        if (col && col.label) { let val = row.c[index] ? (row.c[index].f || row.c[index].v) : ''; rowObj[col.label] = (val === null || val === undefined) ? '' : val.toString().trim(); }
                    });
                    resultData.push(rowObj);
                });
                localStorage.setItem('cachedAnnouncements', JSON.stringify(resultData)); processData(resultData);
            } catch (e) { loadFromCache(); }
            delete window.parseGoogleSheetData;
        };
        const script = document.createElement('script'); script.src = url; script.onerror = function () { clearTimeout(fetchTimeout); loadFromCache(); }; document.body.appendChild(script);
    }

    function getMediaType(url) {
        if (!url) return null; const lower = url.toLowerCase();
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
        if (['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext))) return 'video'; return 'image';
    }
    function getYouTubeId(url) { const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/); return match ? match[1] : null; }

    function processData(rows) {
        const newDataString = JSON.stringify(rows);
        if (currentDataString === newDataString && slides.length > 0) { if (els.loadingSlide) els.loadingSlide.style.display = 'none'; return; }
        currentDataString = newDataString; clearAllTimers(); slides = []; tickerItems = [];

        rows.forEach(row => {
            const normalized = {}; Object.keys(row).forEach(key => { normalized[(key || '').trim().toLowerCase()] = (row[key] || '').toString().trim(); });
            const baslik = normalized['baslik'] || normalized['başlık'] || '';
            const aktif = (normalized['aktif'] || 'evet').toLowerCase();
            if (aktif === 'hayır' || aktif === 'h' || aktif === 'no' || !baslik) return;

            const videoLinks = (normalized['video'] || '').split(',').map(s=>s.trim()).filter(Boolean);
            const gorselLinks = (normalized['gorsel'] || normalized['görsel'] || normalized['resim'] || '').split(',').map(s=>s.trim()).filter(Boolean);
            
            let album = [];
            videoLinks.forEach(v => { const type = getMediaType(v); if(type) album.push({url: v, mediaType: type}); });
            gorselLinks.forEach(g => { const type = getMediaType(g); if(type) album.push({url: g, mediaType: type}); });

            const item = {
                baslik, icerik: normalized['icerik'] || normalized['içerik'] || '',
                kategori: (normalized['kategori'] || '').toLowerCase(),
                catInfo: CATEGORY_MAP[(normalized['kategori'] || '').toLowerCase()] || DEFAULT_CATEGORY,
                album: album, isAlbum: album.length > 1
            };

            const bant = (normalized['bant'] || 'hayir').toLowerCase();
            if (bant === 'evet' || bant === 'e' || bant === 'yes') tickerItems.push(item);
            slides.push(item);
        });

        if (slides.length > 7) slides = slides.slice(0, 7);
        if (els.loadingSlide) els.loadingSlide.style.display = 'none';
        if (slides.length === 0) { showError('Gösterilecek aktif duyuru bulunamadı.'); return; }
        renderSlides(); renderDots(); renderTicker(); startSlideshow();
    }

    function buildMediaHtml(item, slideIndex) {
        if (!item.album || item.album.length === 0) return '';
        let html = `<div class="slide-media" id="media-container-${slideIndex}">`;
        item.album.forEach((media, albumIndex) => {
            let innerHtml = '';
            if (media.mediaType === 'image') innerHtml = `<img src="${escapeAttr(media.url)}" loading="lazy">`;
            else if (media.mediaType === 'video') innerHtml = `<video id="html-video-${slideIndex}-${albumIndex}" src="${escapeAttr(media.url)}" playsinline style="width:100%;height:100%;object-fit:cover;"></video>`;
            else if (media.mediaType === 'youtube') innerHtml = `<div id="yt-player-${slideIndex}-${albumIndex}" data-vid="${getYouTubeId(media.url)}" style="width:100%;height:100%;pointer-events:none;"></div>`;
            html += `<div class="album-item" id="album-item-${slideIndex}-${albumIndex}">${innerHtml}</div>`;
        });
        return html + `</div>`;
    }

    function renderSlides() {
        destroyAllPlayers(); els.slidesContainer.innerHTML = '';
        slides.forEach((item, index) => {
            const slideEl = document.createElement('div'); slideEl.className = `slide ${index === 0 ? 'active' : ''}`;
            const noMediaClass = item.album.length > 0 ? '' : 'no-media';
            slideEl.innerHTML = `
                <div class="slide-card ${item.catInfo.class} ${noMediaClass}">
                    ${buildMediaHtml(item, index)}
                    <div class="slide-text">
                        ${item.album.length > 0 ? '' : `<div class="slide-icon">${item.catInfo.icon}</div>`}
                        <div class="slide-category ${item.catInfo.class}">${item.catInfo.label}</div>
                        <h2 class="slide-title">${escapeHtml(item.baslik)}</h2>
                        <p class="slide-content">${escapeHtml(item.icerik)}</p>
                    </div>
                    <div class="slide-progress" id="progress-${index}"></div>
                </div>`;
            els.slidesContainer.appendChild(slideEl);
        });
        initYouTubePlayers(); currentSlideIndex = 0;
    }

    function initYouTubePlayers() {
        if (!window.ytApiReady) return;
        document.querySelectorAll('[id^="yt-player-"]').forEach(el => {
            let vid = el.getAttribute('data-vid'); let idx = el.id.replace('yt-player-', '');
            if (window.ytPlayers[idx]) return;
            window.ytPlayers[idx] = new YT.Player(el.id, {
                videoId: vid, playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, mute: 0, showinfo: 0, disablekb: 1 },
                events: { 'onStateChange': (e) => { if (window.currentYtStateCallback) window.currentYtStateCallback(e.data); }, 'onError': (e) => { if (window.currentYtErrorCallback) window.currentYtErrorCallback(e.data); } }
            });
        });
    }

    function renderDots() { els.slideDots.innerHTML = ''; slides.forEach((_, i) => { const dot = document.createElement('div'); dot.className = `slide-dot ${i === 0 ? 'active' : ''}`; els.slideDots.appendChild(dot); }); }
    function renderTicker() {
        let items = tickerItems.length > 0 ? tickerItems : slides;
        let displayItems = items.map(s => ({ icon: s.catInfo.icon, text: s.baslik + (s.icerik ? '  —  ' + s.icerik : '') }));
        if (displayItems.length === 0) { els.tickerContent.textContent = 'Henüz duyuru bulunmuyor'; return; }
        els.tickerContent.className = 'ticker-content scroll-mode';
        const buildItems = () => displayItems.map(item => `<span class="ticker-item"><span class="ticker-item-icon">${item.icon}</span> ${escapeHtml(item.text)}</span>`).join('<span class="ticker-separator">●</span>');
        els.tickerContent.innerHTML = buildItems() + '<span class="ticker-separator">●</span>' + buildItems();
        requestAnimationFrame(() => { els.tickerContent.style.setProperty('--ticker-duration', `${(els.tickerContent.scrollWidth / 2) / CONFIG.TICKER_SCROLL_SPEED}s`); });
    }

    function startSlideshow() { if (slides.length > 0) playCurrentSlide(); }

    function playCurrentSlide() {
        clearAllTimers(); document.querySelectorAll('.slide-progress').forEach(bar => { bar.style.width = '0%'; bar.style.transition = 'none'; });
        const item = slides[currentSlideIndex]; if (!item) return;
        currentAlbumIndex = 0;
        if(item.album.length > 0) { playAlbumItem(item, currentSlideIndex, currentAlbumIndex); } 
        else { startProgress(CONFIG.SLIDE_INTERVAL); currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL); scheduleNextPreview(); }
    }

    function playAlbumItem(item, sIndex, aIndex) {
        clearAllTimers(); const media = item.album[aIndex];
        const container = document.getElementById(`media-container-${sIndex}`);
        const textElement = container.closest('.slide-card').querySelector('.slide-text');

        document.querySelectorAll(`#media-container-${sIndex} .album-item`).forEach(el => el.classList.remove('active'));
        document.getElementById(`album-item-${sIndex}-${aIndex}`).classList.add('active');

        if (item.isAlbum) { container.classList.add('fullscreen-media'); if (textElement) textElement.classList.add('text-hidden'); } 
        else { container.classList.remove('fullscreen-media'); if (textElement) textElement.classList.remove('text-hidden'); }

        if (media.mediaType === 'youtube' || media.mediaType === 'video') { handleVideoSlide(media, `${sIndex}-${aIndex}`, container, textElement, item); } 
        else {
            if (!item.isAlbum) startProgress(CONFIG.SLIDE_INTERVAL);
            currentSlideTimeout = setTimeout(() => { progressToNextAlbumItem(item, sIndex, aIndex); }, item.isAlbum ? 6000 : CONFIG.SLIDE_INTERVAL);
        }
    }

    function handleVideoSlide(media, idIndex, container, textElement, item) {
        if (media.mediaType === 'youtube' && !navigator.onLine) { currentSlideTimeout = setTimeout(() => progressToNextAlbumItem(item, currentSlideIndex, currentAlbumIndex), 100); return; }
        const advance = () => progressToNextAlbumItem(item, currentSlideIndex, currentAlbumIndex);

        if (media.mediaType === 'youtube') {
            const playerObj = window.ytPlayers[idIndex];
            if (!window.ytApiReady || !playerObj || typeof playerObj.playVideo !== 'function') { currentSlideTimeout = setTimeout(advance, CONFIG.SLIDE_INTERVAL); return; }
            fallbackTimer = setTimeout(advance, 10000); playerObj.seekTo(0); playerObj.playVideo();
            window.currentYtErrorCallback = () => { clearTimeout(fallbackTimer); advance(); };
            window.currentYtStateCallback = (state) => {
                if (state === 1) clearTimeout(fallbackTimer);
                if (state === 3) { clearTimeout(fallbackTimer); fallbackTimer = setTimeout(advance, 15000); }
                if (state === 0) { clearTimeout(fallbackTimer); advance(); }
            };
        } else if (media.mediaType === 'video') {
            const playerObj = document.getElementById(`html-video-${idIndex}`);
            if (playerObj) {
                fallbackTimer = setTimeout(advance, 10000); playerObj.currentTime = 0;
                playerObj.play().then(() => clearTimeout(fallbackTimer)).catch(e => { clearTimeout(fallbackTimer); advance(); });
                playerObj.onwaiting = () => { clearTimeout(fallbackTimer); fallbackTimer = setTimeout(advance, 15000); };
                playerObj.onplaying = () => clearTimeout(fallbackTimer);
                playerObj.onended = () => { clearTimeout(fallbackTimer); advance(); };
                playerObj.onerror = () => { clearTimeout(fallbackTimer); advance(); };
            }
        }
        if (!item.isAlbum) { fullscreenTriggerTimer = setTimeout(() => { container.classList.add('fullscreen-media'); if (textElement) textElement.classList.add('text-hidden'); }, 4000); }
    }

    function progressToNextAlbumItem(item, sIndex, aIndex) {
        stopSlideMedia(`${sIndex}-${aIndex}`, item.album[aIndex]);
        if (aIndex + 1 < item.album.length) {
            currentAlbumIndex++; playAlbumItem(item, sIndex, currentAlbumIndex);
        } else {
            const container = document.getElementById(`media-container-${sIndex}`);
            const textElement = container.closest('.slide-card').querySelector('.slide-text');
            if (item.isAlbum || container.classList.contains('fullscreen-media')) {
                container.classList.remove('fullscreen-media'); if (textElement) textElement.classList.remove('text-hidden');
                setTimeout(nextSlide, 1500);
            } else { nextSlide(); }
        }
    }

    function stopSlideMedia(idIndex, media) {
        if (!media) return;
        if (media.mediaType === 'youtube' && window.ytPlayers[idIndex] && typeof window.ytPlayers[idIndex].pauseVideo === 'function') window.ytPlayers[idIndex].pauseVideo();
        else if (media.mediaType === 'video') { const video = document.getElementById(`html-video-${idIndex}`); if (video) video.pause(); }
    }

    function nextSlide() {
        clearAllTimers();
        if (slides.length > 1) {
            const allSlides = els.slidesContainer.querySelectorAll('.slide'); const allDots = els.slideDots.querySelectorAll('.slide-dot');
            allSlides[currentSlideIndex].classList.remove('active'); allSlides[currentSlideIndex].classList.add('exit-left');
            if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.remove('active');
            const prevIndex = currentSlideIndex; setTimeout(() => { if (allSlides[prevIndex]) allSlides[prevIndex].classList.remove('exit-left'); }, 900);
            currentSlideIndex = (currentSlideIndex + 1) % slides.length;
            allSlides[currentSlideIndex].classList.remove('exit-left'); allSlides[currentSlideIndex].classList.add('active');
            if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.add('active');
        }
        if (els.slideCounter) els.slideCounter.innerHTML = `<span class="current">${currentSlideIndex + 1}</span> / ${slides.length}`;
        playCurrentSlide();
    }

    function startProgress(duration) {
        const progressBar = document.getElementById(`progress-${currentSlideIndex}`); if (!progressBar) return; let elapsed = 0;
        progressBar.style.transition = 'none'; progressBar.style.width = '0%'; void progressBar.offsetWidth;
        progressTimer = setInterval(() => { elapsed += CONFIG.PROGRESS_STEP; progressBar.style.width = `${Math.min((elapsed / duration) * 100, 100)}%`; progressBar.style.transition = `width ${CONFIG.PROGRESS_STEP}ms linear`; }, CONFIG.PROGRESS_STEP);
    }

    function scheduleNextPreview() {
        if (nextPreviewTimer) clearTimeout(nextPreviewTimer); if (slides.length <= 1 || !els.nextPreview) return;
        const currentItem = slides[currentSlideIndex]; if (currentItem.album.length > 0) return;
        nextPreviewTimer = setTimeout(() => { els.nextPreviewTitle.textContent = slides[(currentSlideIndex + 1) % slides.length].baslik; els.nextPreview.classList.add('visible'); setTimeout(() => els.nextPreview.classList.remove('visible'), 2800); }, CONFIG.SLIDE_INTERVAL - CONFIG.NEXT_PREVIEW_SHOW);
    }

    function showError(message) { els.slidesContainer.innerHTML = `<div class="slide active"><div class="slide-card cat-onemli no-media"><div class="slide-text"><div class="slide-icon">⚠️</div><h2 class="slide-title">Bilgi Ekranı</h2><p class="slide-content">${escapeHtml(message)}</p></div></div></div>`; }
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function escapeAttr(text) { return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fetchFreeWeather() { if (!navigator.onLine) return; fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LAT}&longitude=${CONFIG.WEATHER_LON}&current_weather=true`).then(r => r.json()).then(data => { if (data.current_weather) { const temp = Math.round(data.current_weather.temperature); if (els.weatherTemp) els.weatherTemp.textContent = `${temp}°C`; if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY; if (els.weatherDesc) els.weatherDesc.textContent = 'Güncel'; } }).catch(() => { }); }
    function fetchWeather() { fetchFreeWeather(); }

    window.addEventListener('online', () => { if (els.offlineBadge) els.offlineBadge.classList.add('hidden'); });
    window.addEventListener('offline', () => { if (els.offlineBadge) els.offlineBadge.classList.remove('hidden'); });
    document.addEventListener('DOMContentLoaded', init);
})();
