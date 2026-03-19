/* ============================================
   TV KIOSK - APP.JS v5.4 (Smart Data Refresh & Memory Cleanup)
   Google Sheets Integration & Slide Engine
   ============================================ */

(function () {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        SLIDE_INTERVAL: 10000,      
        DATA_REFRESH: 120000, // 2 dakikada bir kontrol eder
        CLOCK_REFRESH: 1000,
        PROGRESS_STEP: 50,
        TICKER_CYCLE: 6000,
        TICKER_SCROLL_SPEED: 70,
        WEATHER_REFRESH: 600000,
        WEATHER_CITY: 'Sultangazi',
        WEATHER_LAT: 41.1075,
        WEATHER_LON: 28.8617,
        NEXT_PREVIEW_SHOW: 3000,
        RETRY_DELAY: 10000,
        MAX_RETRIES: 5,
    };

    // --- Dynamic CSS Injection for In-Card Fullscreen ---
    const dynamicStyle = document.createElement('style');
    dynamicStyle.innerHTML = `
        .slide-media {
            transition: width 1s cubic-bezier(0.25, 1, 0.5, 1) !important;
            z-index: 50;
            background: #000;
        }
        .slide-media::after {
            transition: opacity 0.5s ease;
        }
        .fullscreen-media {
            width: 100% !important; 
        }
        .fullscreen-media::after {
            opacity: 0 !important; 
        }
        .slide-text {
            transition: opacity 0.5s ease;
        }
        .text-hidden {
            opacity: 0 !important;
        }
    `;
    document.head.appendChild(dynamicStyle);

    // --- YouTube API Setup ---
    window.ytApiReady = false;
    window.ytPlayers = {};
    window.currentYtStateCallback = null;

    window.onYouTubeIframeAPIReady = function () {
        window.ytApiReady = true;
        initYouTubePlayers();
    };

    const ytScript = document.createElement('script');
    ytScript.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag) {
        firstScriptTag.parentNode.insertBefore(ytScript, firstScriptTag);
    } else {
        document.head.appendChild(ytScript);
    }

    function onPlayerStateChange(event) {
        if (window.currentYtStateCallback) {
            window.currentYtStateCallback(event.data);
        }
    }

    function onPlayerError(event) {
        if (window.currentYtErrorCallback) {
            window.currentYtErrorCallback(event.data);
        }
    }

    // --- Category Mappings ---
    const CATEGORY_MAP = {
        'duyuru': { icon: '📋', class: 'cat-duyuru', label: 'Duyuru' },
        'etkinlik': { icon: '🎉', class: 'cat-etkinlik', label: 'Etkinlik' },
        'sinav': { icon: '📝', class: 'cat-sinav', label: 'Sınav' },
        'sınav': { icon: '📝', class: 'cat-sinav', label: 'Sınav' },
        'onemli': { icon: '🔴', class: 'cat-onemli', label: 'Önemli' },
        'önemli': { icon: '🔴', class: 'cat-onemli', label: 'Önemli' },
        'acil': { icon: '🚨', class: 'cat-onemli', label: 'Acil' },
        'spor': { icon: '⚽', class: 'cat-etkinlik', label: 'Spor' },
        'bilim': { icon: '🔬', class: 'cat-etkinlik', label: 'Bilim' },
        'teknoloji': { icon: '💻', class: 'cat-etkinlik', label: 'Teknoloji' },
        'toplantı': { icon: '👥', class: 'cat-duyuru', label: 'Toplantı' },
        'kutlama': { icon: '🎊', class: 'cat-etkinlik', label: 'Kutlama' },
    };
    const DEFAULT_CATEGORY = { icon: '📌', class: 'cat-default', label: 'Bilgi' };

    const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    const CITY_DATA = {
        "Ankara": [39.9334, 32.8597], "İstanbul": [41.0082, 28.9784], "İzmir": [38.4237, 27.1428],
        "Bursa": [40.1826, 29.0665], "Antalya": [36.8969, 30.7133], "Adana": [37.0000, 35.3213],
        "Konya": [37.8746, 32.4932], "Gaziantep": [37.0660, 37.3781], "Mersin": [36.8121, 34.6415],
        "Kayseri": [38.7312, 35.4787], "Eskişehir": [39.7668, 30.5256], "Diyarbakır": [37.9144, 40.2306],
        "Samsun": [41.2928, 36.3313], "Trabzon": [41.0027, 39.7168], "Erzurum": [39.9055, 41.2658],
        "Malatya": [38.3554, 38.3335], "Van": [38.4956, 43.3832], "Denizli": [37.7765, 29.0864]
    };

    // --- State Variables ---
    let slides = [];
    let tickerItems = [];
    let currentSlideIndex = 0;
    
    // Zamanlayıcıları Global Yapıyoruz (Temizleyebilmek için)
    let currentSlideTimeout = null;
    let progressTimer = null;
    let nextPreviewTimer = null;
    let fullscreenTriggerTimer = null;
    let fallbackTimer = null; 
    
    let retryCount = 0;
    let currentDataString = null; // Veri değişikliğini takip eden kimlik

    const els = {};

    function cacheDom() {
        els.setupPrompt = document.getElementById('setup-prompt');
        els.mainDisplay = document.getElementById('main-display');
        els.offlineBadge = document.getElementById('offline-badge');
        els.schoolName = document.getElementById('school-name');
        els.schoolLogo = document.getElementById('school-logo');
        els.defaultSchoolIcon = document.getElementById('default-school-icon');
        els.time = document.getElementById('time');
        els.date = document.getElementById('date');
        els.slidesContainer = document.getElementById('slides-container');
        els.slideDots = document.getElementById('slide-dots');
        els.slideCounter = document.getElementById('slide-counter');
        els.tickerContent = document.getElementById('ticker-content');
        els.loadingSlide = document.getElementById('loading-slide');
        els.weatherIcon = document.getElementById('weather-icon');
        els.weatherTemp = document.getElementById('weather-temp');
        els.weatherDesc = document.getElementById('weather-desc');
        els.weatherCity = document.getElementById('weather-city');
        els.nextPreview = document.getElementById('next-slide-preview');
        els.nextPreviewTitle = document.getElementById('next-preview-title');
    }

    // --- TEMİZLİK MOTORU (MEMORY LEAK ÖNLEYİCİ) ---
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

    // --- OTO ÖLÇEKLENDİRME ---
    function applyAutoScaling() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
        }

        document.documentElement.style.overflow = 'hidden';
        document.body.style.width = '100vw';
        document.body.style.height = '100vh';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';

        function setFixedCanvas(el) {
            if (!el) return;
            el.style.width = '1920px';
            el.style.height = '1080px';
            el.style.position = 'absolute';
            el.style.top = '50%';
            el.style.left = '50%';
            el.style.transformOrigin = 'center center';
        }

        setFixedCanvas(els.mainDisplay);
        setFixedCanvas(els.setupPrompt);

        function resizeKiosk() {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const scale = Math.min(winW / 1920, winH / 1080);
            
            if (els.mainDisplay) els.mainDisplay.style.transform = `translate(-50%, -50%) scale(${scale})`;
            if (els.setupPrompt) els.setupPrompt.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }

        window.addEventListener('resize', resizeKiosk);
        resizeKiosk();
    }

    // --- BOOT PROCESS ---
    function init() {
        cacheDom();
        applyAutoScaling(); 
        
        const urlParams = new URLSearchParams(window.location.search);
        
        const magicId = urlParams.get('id');
        if (magicId) {
            runMagicBoot(magicId);
            return; 
        }

        continueInit();
    }

    function runMagicBoot(sheetId) {
        let cleanId = sheetId;
        if (cleanId.includes('docs.google.com')) {
            const match = cleanId.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) cleanId = match[1];
        }

        localStorage.setItem('kiosk_sheet_id', cleanId);
        localStorage.removeItem('kiosk_demo_mode');

        if (els.loadingSlide) {
            const p = els.loadingSlide.querySelector('.slide-content');
            if (p) p.textContent = 'Sihirli Link doğrulandı, sistem ayarları çekiliyor...';
        }

        const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json;responseHandler:magicAppCallback&sheet=AYARLAR`;
        const scriptId = 'jsonp-magic-app';

        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        window.magicAppCallback = function(json) {
            try {
                const rows = json.table.rows;
                let settings = {};
                rows.forEach(row => {
                    if (row.c && row.c[0] && row.c[1]) {
                        settings[(row.c[0].v || '').toString().trim()] = (row.c[1].v || '').toString().trim();
                    }
                });

                if (settings['Okul Adı']) localStorage.setItem('kiosk_school_name', settings['Okul Adı']);
                if (settings['App Script URL']) localStorage.setItem('kiosk_script_url', settings['App Script URL']);
                if (settings['Logo URL']) localStorage.setItem('kiosk_school_logo', settings['Logo URL']);
                if (settings['Yönetici Şifresi']) localStorage.setItem('kiosk_admin_password', settings['Yönetici Şifresi']);
                
                let city = settings['Hava Durumu Şehri'];
                if (city) {
                    localStorage.setItem('kiosk_weather_city', city);
                    if (CITY_DATA[city]) {
                        localStorage.setItem('kiosk_weather_lat', CITY_DATA[city][0]);
                        localStorage.setItem('kiosk_weather_lon', CITY_DATA[city][1]);
                    }
                }
            } catch(e) {
                console.log('AYARLAR sekmesi okunamadı, varsayılanlarla devam edilecek.');
            }
            
            delete window.magicAppCallback;
            
            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }

            continueInit();
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        script.onerror = function() {
            continueInit();
        };
        document.body.appendChild(script);
    }

    function continueInit() {
        const urlParams = new URLSearchParams(window.location.search);
        const isDemo = urlParams.has('demo') || localStorage.getItem('kiosk_demo_mode') === 'true';

        if (isDemo) { startDemoMode(); return; }

        const sheetId = localStorage.getItem('kiosk_sheet_id');
        const schoolName = localStorage.getItem('kiosk_school_name');
        const schoolLogo = localStorage.getItem('kiosk_school_logo');
        const weatherCity = localStorage.getItem('kiosk_weather_city');

        if (!sheetId) { showSetupPrompt(); return; }

        if (schoolName) {
            els.schoolName.textContent = schoolName;
            document.title = schoolName + ' — Bilgi Ekranı';
        }

        if (schoolLogo && els.schoolLogo) {
            els.schoolLogo.src = schoolLogo;
            els.schoolLogo.style.display = 'block';
            if (els.defaultSchoolIcon) els.defaultSchoolIcon.style.display = 'none';
        }

        if (weatherCity) CONFIG.WEATHER_CITY = weatherCity;

        const weatherLat = localStorage.getItem('kiosk_weather_lat');
        const weatherLon = localStorage.getItem('kiosk_weather_lon');
        if (weatherLat && weatherLon) {
            CONFIG.WEATHER_LAT = parseFloat(weatherLat);
            CONFIG.WEATHER_LON = parseFloat(weatherLon);
        }

        startClock();
        fetchWeather();
        fetchData(sheetId);
        
        // 2 dakikada bir kontrol eder
        setInterval(() => fetchData(sheetId), CONFIG.DATA_REFRESH);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);
    }

    function startDemoMode() {
        els.schoolName.textContent = 'Gazi MTAL';
        startClock(); fetchFreeWeather();
        const demoRows = [{
            baslik: 'Örnek Duyuru', icerik: 'Sistem demo modunda çalışıyor.', kategori: 'duyuru', tarih: '', aktif: 'evet', bant: 'evet', gorsel: '', video: ''
        }];
        processData(demoRows);
    }

    function showSetupPrompt() {
        els.setupPrompt.classList.remove('hidden');
        els.mainDisplay.classList.add('hidden');
    }

    function startClock() {
        updateClock();
        setInterval(updateClock, CONFIG.CLOCK_REFRESH);
    }

    function updateClock() {
        const now = new Date();
        els.time.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        els.date.textContent = `${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}, ${TR_DAYS[now.getDay()]}`;
    }

    function getCleanSheetId(sheetId) {
        if (sheetId.includes('docs.google.com')) {
            const match = sheetId.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) sheetId = match[1];
        }
        return sheetId;
    }

    function loadFromCache(failedUrl) {
        if (els.offlineBadge) els.offlineBadge.classList.remove('hidden');
        const cachedData = localStorage.getItem('cachedAnnouncements');
        if (cachedData) {
            try { processData(JSON.parse(cachedData)); } catch (e) { showError('Önbellek bozuk.'); }
        } else {
            showError('İnternet bağlantısı yok.');
        }
    }

    function fetchData(sheetId) {
        const id = getCleanSheetId(sheetId);
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetData&sheet=DUYURULAR`;
        const scriptId = 'jsonp-sheet-fetch';

        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        window.parseGoogleSheetData = function (json) {
            if (els.offlineBadge) els.offlineBadge.classList.add('hidden');
            retryCount = 0;
            try {
                const cols = json.table.cols;
                const rows = json.table.rows;
                const resultData = [];
                rows.forEach(row => {
                    const rowObj = {};
                    cols.forEach((col, index) => {
                        if (col && col.label) {
                            let val = row.c[index] ? (row.c[index].f || row.c[index].v) : '';
                            rowObj[col.label] = (val === null || val === undefined) ? '' : val.toString().trim();
                        }
                    });
                    resultData.push(rowObj);
                });
                localStorage.setItem('cachedAnnouncements', JSON.stringify(resultData));
                processData(resultData);
            } catch (e) { loadFromCache(url); }
            delete window.parseGoogleSheetData;
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        script.onerror = function () {
            retryCount++;
            if (retryCount <= CONFIG.MAX_RETRIES) setTimeout(() => fetchData(sheetId), CONFIG.RETRY_DELAY);
            else loadFromCache(url);
        };
        document.body.appendChild(script);
    }

    function getMediaType(url) {
        if (!url) return null;
        const lower = url.toLowerCase();
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
        if (['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext))) return 'video';
        return 'image';
    }

    function getYouTubeId(url) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
        return match ? match[1] : null;
    }

    function processData(rows) {
        // YENİ: Veri Değişiklik Kontrolü
        const newDataString = JSON.stringify(rows);
        
        // Eğer tabloda bir değişiklik yoksa, çalışan slaytı bozma!
        if (currentDataString === newDataString && slides.length > 0) {
            if (els.loadingSlide) els.loadingSlide.style.display = 'none';
            return; 
        }
        
        // Değişiklik varsa hafızayı yeni veriye eşitle
        currentDataString = newDataString;

        // Geçmiş işlemleri durdur ve hafızayı temizle
        clearAllTimers();

        slides = []; tickerItems = [];
        rows.forEach(row => {
            const normalized = {};
            Object.keys(row).forEach(key => { normalized[(key || '').trim().toLowerCase()] = (row[key] || '').toString().trim(); });

            const baslik = normalized['baslik'] || normalized['başlık'] || '';
            const aktif = (normalized['aktif'] || 'evet').toLowerCase();
            if (aktif === 'hayır' || aktif === 'hayir' || aktif === 'h' || aktif === 'no' || !baslik) return;

            const video = normalized['video'] || '';
            const gorsel = normalized['gorsel'] || normalized['görsel'] || normalized['resim'] || '';
            let mediaUrl = video || gorsel;
            let mediaType = video ? getMediaType(video) : (gorsel ? getMediaType(gorsel) : null);

            const item = {
                baslik, icerik: normalized['icerik'] || normalized['içerik'] || '',
                kategori: (normalized['kategori'] || '').toLowerCase(),
                tarih: normalized['tarih'] || '',
                catInfo: CATEGORY_MAP[(normalized['kategori'] || '').toLowerCase()] || DEFAULT_CATEGORY,
                mediaUrl, mediaType
            };

            const bant = (normalized['bant'] || 'hayir').toLowerCase();
            if (bant === 'evet' || bant === 'e' || bant === 'yes') tickerItems.push(item);
            slides.push(item);
        });

        if (els.loadingSlide) els.loadingSlide.style.display = 'none';
        if (slides.length === 0) { showError('Gösterilecek aktif duyuru bulunamadı.'); return; }

        renderSlides();
        renderDots();
        renderTicker();
        startSlideshow();
    }

    function buildMediaHtml(item, index) {
        if (!item.mediaUrl || !item.mediaType) return '';
        if (item.mediaType === 'image') {
            return `<div class="slide-media image-container" id="media-container-${index}">
                <img src="${escapeAttr(item.mediaUrl)}" loading="lazy" onerror="this.closest('.slide-media').style.display='none'; this.closest('.slide-card').classList.add('no-media');">
            </div>`;
        } else if (item.mediaType === 'video') {
            return `<div class="slide-media video-container" id="media-container-${index}">
                <video id="html-video-${index}" src="${escapeAttr(item.mediaUrl)}" muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>
            </div>`;
        } else if (item.mediaType === 'youtube') {
            const ytId = getYouTubeId(item.mediaUrl);
            if (!ytId) return '';
            return `<div class="slide-media yt-container" id="media-container-${index}">
                <div id="yt-player-${index}" data-vid="${ytId}" style="width:100%;height:100%;pointer-events:none;"></div>
            </div>`;
        }
        return '';
    }

    function renderSlides() {
        // Ekranı temizlemeden önce RAM'deki YouTube hafızasını tamamen yok et
        destroyAllPlayers();
        els.slidesContainer.innerHTML = '';
        
        slides.forEach((item, index) => {
            const slideEl = document.createElement('div');
            slideEl.className = `slide ${index === 0 ? 'active' : ''}`;
            const hasMedia = item.mediaUrl && item.mediaType;
            const noMediaClass = hasMedia ? '' : 'no-media';

            const progressHtml = (item.mediaType === 'youtube' || item.mediaType === 'video')
                ? ''
                : `<div class="slide-progress" id="progress-${index}"></div>`;

            slideEl.innerHTML = `
                <div class="slide-card ${item.catInfo.class} ${noMediaClass}">
                    ${buildMediaHtml(item, index)}
                    <div class="slide-text">
                        ${hasMedia ? '' : `<div class="slide-icon">${item.catInfo.icon}</div>`}
                        <div class="slide-category ${item.catInfo.class}">${item.catInfo.label}</div>
                        <h2 class="slide-title">${escapeHtml(item.baslik)}</h2>
                        <p class="slide-content">${escapeHtml(item.icerik)}</p>
                    </div>
                    ${progressHtml}
                </div>
            `;
            els.slidesContainer.appendChild(slideEl);
        });

        initYouTubePlayers();
        currentSlideIndex = 0;
    }

    function initYouTubePlayers() {
        if (!window.ytApiReady) return;

        document.querySelectorAll('[id^="yt-player-"]').forEach(el => {
            let vid = el.getAttribute('data-vid');
            let idx = el.id.replace('yt-player-', '');
            
            if (window.ytPlayers[idx]) return;

            window.ytPlayers[idx] = new YT.Player(el.id, {
                videoId: vid,
                playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, mute: 1, showinfo: 0, disablekb: 1 },
                events: { 
                    'onStateChange': onPlayerStateChange,
                    '
