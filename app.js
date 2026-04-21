/* ============================================
   TV KIOSK - APP.JS v6.0 (Smart Offline & Sidebar)
   beIN Sports Haber Tarzı Bilgi Paneli
   Ders Saati, Nöbetçi Öğretmen/Öğrenci Paneli
   ============================================ */

(function () {
    'use strict';

    // --- Configuration ---
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
        LESSON_REFRESH: 1000,
    };

    // --- Ders Programı (Varsayılan Fallback) ---
    let LESSON_SCHEDULE = [
        { period: 1, start: '08:30', end: '09:10' },
        { period: 2, start: '09:20', end: '10:00' },
        { period: 3, start: '10:10', end: '10:50' },
        { period: 4, start: '11:00', end: '11:40' },
        { period: 5, start: '11:50', end: '12:30' },
        { period: 6, start: '13:10', end: '13:50' },
        { period: 7, start: '14:00', end: '14:40' },
        { period: 8, start: '14:50', end: '15:30' },
    ];

    // --- Varsayılan Nöbetçi Verileri (Fallback) ---
    const DEFAULT_DUTY_TEACHERS = [
        { floor: 'Zemin Kat', name: '—' },
        { floor: '1. Kat', name: '—' },
        { floor: '2. Kat', name: '—' },
        { floor: '3. Kat', name: '—' },
        { floor: 'Bahçe', name: '—' },
    ];

    const DEFAULT_DUTY_STUDENTS = [];

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
    
    let currentSlideTimeout = null;
    let progressTimer = null;
    let nextPreviewTimer = null;
    let fullscreenTriggerTimer = null;
    let fallbackTimer = null; 
    
    let currentDataString = null;

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
        // Sidebar elements
        els.infoSidebar = document.getElementById('info-sidebar');
        els.lessonPeriod = document.getElementById('lesson-period');
        els.lessonStatus = document.getElementById('lesson-status');
        els.lessonCountdownLabel = document.getElementById('lesson-countdown-label');
        els.lessonCountdown = document.getElementById('lesson-countdown');
        els.lessonProgressFill = document.getElementById('lesson-progress-fill');
        els.lessonCard = document.querySelector('.lesson-card');
        els.dutyTeachersList = document.getElementById('duty-teachers-list');
        els.dutyStudentsList = document.getElementById('duty-students-list');
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
        
        // İlk açılışta internet kontrolü (hayalet simge için)
        if (!navigator.onLine && els.offlineBadge) {
            els.offlineBadge.classList.remove('hidden');
        }

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

        // İnternet yoksa direkt atla
        if (!navigator.onLine) {
            continueInit();
            return;
        }

        if (els.loadingSlide) {
            const p = els.loadingSlide.querySelector('.slide-content');
            if (p) p.textContent = 'Sistem ayarları çekiliyor...';
        }

        const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json;responseHandler:magicAppCallback&sheet=AYARLAR&headers=1`;
        const scriptId = 'jsonp-magic-app';

        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        // Magic Boot Zaman Aşımı Koruması (Ağ yavaşsa)
        let magicTimeout = setTimeout(() => {
            if (window.magicAppCallback) {
                delete window.magicAppCallback;
                continueInit();
            }
        }, 8000);

        window.magicAppCallback = function(json) {
            clearTimeout(magicTimeout);
            try {
                const rows = json.table.rows;
                let settings = {};
                rows.forEach(row => {
                    if (row.c && row.c[0] && row.c[1]) {
                        let rawKey = (row.c[0].v || '').toString();
                        let cleanKey = rawKey.replace(/\s+/g, '').toLowerCase();
                        let val = (row.c[1].v || '').toString().trim();
                        if (cleanKey) settings[cleanKey] = val;
                    }
                });

                if (settings['okuladi'] || settings['okuladı']) localStorage.setItem('kiosk_school_name', settings['okuladi'] || settings['okuladı']);
                if (settings['scripturl'] || settings['appscripturl']) localStorage.setItem('kiosk_script_url', settings['scripturl'] || settings['appscripturl']);
                if (settings['logourl']) localStorage.setItem('kiosk_school_logo', settings['logourl']);
                if (settings['sifre'] || settings['yöneticişifresi']) localStorage.setItem('kiosk_admin_password', settings['sifre'] || settings['yöneticişifresi']);
                
                let city = settings['sehir'] || settings['şehir'] || settings['havadurumușehri'];
                if (city) {
                    localStorage.setItem('kiosk_weather_city', city);
                    if (CITY_DATA[city]) {
                        localStorage.setItem('kiosk_weather_lat', CITY_DATA[city][0]);
                        localStorage.setItem('kiosk_weather_lon', CITY_DATA[city][1]);
                    }
                }

                let enlem = settings['enlem'];
                let boylam = settings['boylam'];
                if (enlem) localStorage.setItem('kiosk_weather_lat', enlem.replace(',', '.'));
                if (boylam) localStorage.setItem('kiosk_weather_lon', boylam.replace(',', '.'));
            } catch(e) {}
            
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
            clearTimeout(magicTimeout);
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
            els.schoolName.textContent = schoolName + ' Bilgi Ekranı';
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
        
        // Sidebar başlat
        initSidebar();
        
        setInterval(() => fetchData(sheetId), CONFIG.DATA_REFRESH);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);
    }

    function startDemoMode() {
        els.schoolName.textContent = 'Gazi MTAL';
        startClock(); fetchFreeWeather();
        initSidebar();
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

    // --- AKILLI ÇEVRİMDIŞI MOD ---
    function loadFromCache() {
        // Eğer sistem halihazırda çalışıyorsa, dönmeye devam etsin (Kesinti yaşatma)
        if (slides.length > 0) return;

        const cachedData = localStorage.getItem('cachedAnnouncements');
        if (cachedData) {
            try { 
                const parsedData = JSON.parse(cachedData);
                console.log("Çevrimdışı Mod: Hafızadaki verilerle başlatılıyor...");
                processData(parsedData); 
            } catch (e) { 
                showError('Önbellek okunamadı. İnternet bekleniyor...'); 
            }
        } else {
            showError('İnternet bağlantısı yok ve cihaz hafızasında kayıtlı veri bulunamadı.');
        }
    }

    function fetchData(sheetId) {
        const id = getCleanSheetId(sheetId);
        
        // 1. İNTERNET KONTROLÜ
        if (!navigator.onLine) {
            loadFromCache();
            return;
        }

        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetData&sheet=DUYURULAR&headers=1`;
        const scriptId = 'jsonp-sheet-fetch';

        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        // 2. ZAMAN AŞIMI KONTROLÜ
        let fetchTimeout = setTimeout(() => {
            if (window.parseGoogleSheetData) {
                delete window.parseGoogleSheetData;
                loadFromCache();
            }
        }, 8000);

        window.parseGoogleSheetData = function (json) {
            clearTimeout(fetchTimeout); 
            
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
                
                // 3. YEDEKLEME
                localStorage.setItem('cachedAnnouncements', JSON.stringify(resultData));
                
                processData(resultData);
            } catch (e) { loadFromCache(); }
            delete window.parseGoogleSheetData;
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        script.onerror = function () {
            clearTimeout(fetchTimeout);
            loadFromCache(); 
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
        const newDataString = JSON.stringify(rows);
        
        if (currentDataString === newDataString && slides.length > 0) {
            if (els.loadingSlide) els.loadingSlide.style.display = 'none';
            return; 
        }
        
        currentDataString = newDataString;
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

        // 7 İçerik Sınırı (Sadece ilk 7 aktif içerik gösterilsin)
        if (slides.length > 7) slides = slides.slice(0, 7);

        if (els.loadingSlide) els.loadingSlide.style.display = 'none';
        if (slides.length === 0) { showError('Gösterilecek aktif duyuru bulunamadı.'); return; }

        renderSlides();
        renderDots();
        renderTicker();
        startSlideshow();
    }

    function buildMediaHtml(item, slideIndex) {
        if (!item.album || item.album.length === 0) return '';
        let html = `<div class="slide-media" id="media-container-${slideIndex}">`;
        
        item.album.forEach((media, albumIndex) => {
            let innerHtml = '';
            
            if (media.mediaType === 'image') {
                // SİNEMATİK EFEKT: Arkaya bulanıklaştırılmış dev görsel, öne ise kırpılmamış (contain) net görsel
                innerHtml = `
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; background-image:url('${escapeAttr(media.url)}'); background-size:cover; background-position:center; filter:blur(40px); opacity:0.6; transform:scale(1.1);"></div>
                    <img src="${escapeAttr(media.url)}" loading="lazy" style="position:relative; z-index:1; width:100%; height:100%; object-fit:contain; display:block;">
                `;
            } 
            else if (media.mediaType === 'video') {
                // Videolar için de zoom yapmayı engelle ve tam sığdır (contain)
                innerHtml = `<video id="html-video-${slideIndex}-${albumIndex}" src="${escapeAttr(media.url)}" playsinline style="width:100%;height:100%;object-fit:contain;background:#000;"></video>`;
            } 
            else if (media.mediaType === 'youtube') {
                innerHtml = `<div id="yt-player-${slideIndex}-${albumIndex}" data-vid="${getYouTubeId(media.url)}" style="width:100%;height:100%;pointer-events:none;"></div>`;
            }
            
            html += `<div class="album-item" id="album-item-${slideIndex}-${albumIndex}">${innerHtml}</div>`;
        });
        
        return html + `</div>`;
    }

    function renderSlides() {
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
                playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, mute: 0, showinfo: 0, disablekb: 1 },
                events: { 
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        });
    }

    function renderDots() {
        els.slideDots.innerHTML = '';
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `slide-dot ${index === 0 ? 'active' : ''}`;
            els.slideDots.appendChild(dot);
        });
    }

    function renderTicker() {
        let items = tickerItems.length > 0 ? tickerItems : slides;
        let displayItems = items.map(s => ({ icon: s.catInfo.icon, text: s.baslik + (s.icerik ? '  —  ' + s.icerik : '') }));
        if (displayItems.length === 0) { els.tickerContent.textContent = 'Henüz duyuru bulunmuyor'; return; }

        els.tickerContent.className = 'ticker-content scroll-mode';
        const buildItems = () => displayItems.map(item => `<span class="ticker-item"><span class="ticker-item-icon">${item.icon}</span> ${escapeHtml(item.text)}</span>`).join('<span class="ticker-separator">●</span>');
        els.tickerContent.innerHTML = buildItems() + '<span class="ticker-separator">●</span>' + buildItems();

        requestAnimationFrame(() => {
            els.tickerContent.style.setProperty('--ticker-duration', `${(els.tickerContent.scrollWidth / 2) / CONFIG.TICKER_SCROLL_SPEED}s`);
        });
    }

    // --- SLIDESHOW ENGINE ---

    function startSlideshow() {
        if (slides.length === 0) return;
        playCurrentSlide();
    }

    function playCurrentSlide() {
        clearAllTimers(); 
        
        document.querySelectorAll('.slide-progress').forEach(bar => { bar.style.width = '0%'; bar.style.transition = 'none'; });

        const item = slides[currentSlideIndex];
        if (!item) return;

        if (item.mediaType === 'youtube' || item.mediaType === 'video') {
            handleVideoSlide(item, currentSlideIndex);
        } else {
            startProgress(CONFIG.SLIDE_INTERVAL);
            currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL);
            scheduleNextPreview();
        }
    }

    function handleVideoSlide(item, index) {
        const container = document.getElementById(`media-container-${index}`);
        if (!container) { currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL); return; }

        const textElement = container.closest('.slide-card').querySelector('.slide-text');

        container.classList.remove('fullscreen-media');
        if (textElement) textElement.classList.remove('text-hidden');

        // İNTERNET YOKSA YOUTUBE SLAYTINI ANINDA ATLA
        if (item.mediaType === 'youtube' && !navigator.onLine) {
            currentSlideTimeout = setTimeout(nextSlide, 100); 
            return;
        }

        if (item.mediaType === 'youtube') {
            const playerObj = window.ytPlayers[index];
            if (!window.ytApiReady || !playerObj || typeof playerObj.playVideo !== 'function') {
                currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL); return;
            }

            fallbackTimer = setTimeout(() => { nextSlide(); }, 10000);

            playerObj.seekTo(0);
            playerObj.playVideo();

            window.currentYtErrorCallback = (err) => {
                clearTimeout(fallbackTimer);
                nextSlide(); 
            };

            window.currentYtStateCallback = (state) => {
                if (state === 1) { 
                    clearTimeout(fallbackTimer); 
                }
                if (state === 3) { 
                    clearTimeout(fallbackTimer);
                    fallbackTimer = setTimeout(() => { nextSlide(); }, 15000); 
                }
                if (state === 0) { 
                    clearTimeout(fallbackTimer);
                    if (fullscreenTriggerTimer) clearTimeout(fullscreenTriggerTimer);
                    if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                    else nextSlide();
                }
            };
        } else if (item.mediaType === 'video') {
            const playerObj = document.getElementById(`html-video-${index}`);
            if (playerObj) {
                fallbackTimer = setTimeout(() => { nextSlide(); }, 10000);

                playerObj.currentTime = 0;
                playerObj.play().then(() => {
                    clearTimeout(fallbackTimer); 
                }).catch(e => {
                    clearTimeout(fallbackTimer);
                    nextSlide(); 
                });

                playerObj.onwaiting = () => {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = setTimeout(() => { nextSlide(); }, 15000);
                };
                
                playerObj.onplaying = () => { clearTimeout(fallbackTimer); };

                playerObj.onended = () => {
                    clearTimeout(fallbackTimer);
                    if (fullscreenTriggerTimer) clearTimeout(fullscreenTriggerTimer);
                    if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                    else nextSlide();
                };
                
                playerObj.onerror = () => {
                    clearTimeout(fallbackTimer);
                    nextSlide();
                };
            }
        }

        fullscreenTriggerTimer = setTimeout(() => {
            container.classList.add('fullscreen-media');
            if (textElement) textElement.classList.add('text-hidden');
        }, 4000);
    }

    function endVideoSlide(container, textElement) {
        container.classList.remove('fullscreen-media');
        if (textElement) textElement.classList.remove('text-hidden');

        currentSlideTimeout = setTimeout(() => {
            nextSlide();
        }, 2000); 
    }

    function nextSlide() {
        clearAllTimers();
        stopSlideMedia(currentSlideIndex);

        if (slides.length > 1) {
            const allSlides = els.slidesContainer.querySelectorAll('.slide');
            const allDots = els.slideDots.querySelectorAll('.slide-dot');

            allSlides[currentSlideIndex].classList.remove('active');
            allSlides[currentSlideIndex].classList.add('exit-left');
            if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.remove('active');

            const prevIndex = currentSlideIndex;
            setTimeout(() => { if (allSlides[prevIndex]) allSlides[prevIndex].classList.remove('exit-left'); }, 900);

            currentSlideIndex = (currentSlideIndex + 1) % slides.length;

            allSlides[currentSlideIndex].classList.remove('exit-left');
            allSlides[currentSlideIndex].classList.add('active');
            if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.add('active');
        }

        if (els.slideCounter) els.slideCounter.innerHTML = `<span class="current">${currentSlideIndex + 1}</span> / ${slides.length}`;
        playCurrentSlide();
    }

    function stopSlideMedia(index) {
        const item = slides[index];
        if (!item) return;
        const container = document.getElementById(`media-container-${index}`);
        if (container) {
            container.classList.remove('fullscreen-media');
            const textElement = container.closest('.slide-card').querySelector('.slide-text');
            if (textElement) textElement.classList.remove('text-hidden');
        }

        if (item.mediaType === 'youtube' && window.ytPlayers[index] && typeof window.ytPlayers[index].pauseVideo === 'function') {
            window.ytPlayers[index].pauseVideo();
        } else if (item.mediaType === 'video') {
            const video = document.getElementById(`html-video-${index}`);
            if (video) video.pause();
        }
    }

    function startProgress(duration) {
        const progressBar = document.getElementById(`progress-${currentSlideIndex}`);
        if (!progressBar) return;
        let elapsed = 0;

        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        void progressBar.offsetWidth;

        progressTimer = setInterval(() => {
            elapsed += CONFIG.PROGRESS_STEP;
            progressBar.style.width = `${Math.min((elapsed / duration) * 100, 100)}%`;
            progressBar.style.transition = `width ${CONFIG.PROGRESS_STEP}ms linear`;
        }, CONFIG.PROGRESS_STEP);
    }

    function scheduleNextPreview() {
        if (nextPreviewTimer) clearTimeout(nextPreviewTimer);
        if (slides.length <= 1 || !els.nextPreview) return;

        const currentItem = slides[currentSlideIndex];
        // Video/YouTube slaytlarında süre dinamik olduğu için preview gösterme
        if (currentItem.mediaType === 'youtube' || currentItem.mediaType === 'video') return;

        nextPreviewTimer = setTimeout(() => {
            els.nextPreviewTitle.textContent = slides[(currentSlideIndex + 1) % slides.length].baslik;
            els.nextPreview.classList.add('visible');
            setTimeout(() => els.nextPreview.classList.remove('visible'), 2800);
        }, CONFIG.SLIDE_INTERVAL - CONFIG.NEXT_PREVIEW_SHOW);
    }

    function showError(message) {
        els.slidesContainer.innerHTML = `<div class="slide active"><div class="slide-card cat-onemli no-media"><div class="slide-text"><div class="slide-icon">⚠️</div><h2 class="slide-title">Bilgi Ekranı</h2><p class="slide-content">${escapeHtml(message)}</p></div></div></div>`;
    }

    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function escapeAttr(text) { return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // --- Hava Durumu ---
    function fetchFreeWeather() {
        if (!navigator.onLine) return; 
        
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LAT}&longitude=${CONFIG.WEATHER_LON}&current_weather=true`)
            .then(r => r.json())
            .then(data => {
                if (data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    if (els.weatherTemp) els.weatherTemp.textContent = `${temp}°C`;
                    if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY;
                    if (els.weatherDesc) els.weatherDesc.textContent = 'Güncel';
                }
            }).catch(() => { });
    }
    function fetchWeather() { fetchFreeWeather(); }

    // ==================================================
    // SIDEBAR - Ders Bilgisi, Nöbetçi Öğretmen/Öğrenci
    // ==================================================

    // Gün indeksi: 0=Pazar, 1=Pazartesi, ..., 5=Cuma, 6=Cumartesi
    // Sheet sütun sırası: Kat, Pazartesi(1), Sali(2), Carsamba(3), Persembe(4), Cuma(5)
    function getDayColumnIndex() {
        const day = new Date().getDay(); // 0=Pazar
        if (day >= 1 && day <= 5) return day; // 1=Pzt -> sütun 1, 5=Cuma -> sütun 5
        return 0; // Hafta sonu
    }

    function getTodayStrForKiosk() {
        const now = new Date();
        return `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
    }

    function initSidebar() {
        // Ders timer'ını hemen başlat (varsayılan schedule ile)
        updateLessonInfo();
        setInterval(updateLessonInfo, CONFIG.LESSON_REFRESH);

        // Varsayılan verileri göster
        renderDutyTeachers(DEFAULT_DUTY_TEACHERS);
        renderDutyStudents(DEFAULT_DUTY_STUDENTS);

        // Google Sheets'ten gerçek verileri çek
        const sheetId = localStorage.getItem('kiosk_sheet_id');
        if (sheetId && navigator.onLine) {
            fetchLessonSchedule(sheetId);
            fetchDutyTeachers(sheetId);
            fetchDutyStudents(sheetId);
        }
    }

    function fetchLessonSchedule(sheetId) {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler=kioskLessonsCallback&sheet=DERS_SAATLERI&headers=1&t=${Date.now()}`;
        const scriptId = 'jsonp-kiosk-lessons';
        let old = document.getElementById(scriptId); if (old) old.remove();

        window.kioskLessonsCallback = function(json) {
            try {
                const rows = json.table.rows;
                if (rows && rows.length > 0) {
                    const lessons = rows.map(r => ({
                        period: r.c[0] ? parseInt(r.c[0].v) : 0,
                        start: r.c[1] ? (r.c[1].v || '').toString().trim() : '',
                        end: r.c[2] ? (r.c[2].v || '').toString().trim() : ''
                    })).filter(l => l.period > 0 && l.start && l.end);
                    if (lessons.length > 0) {
                        LESSON_SCHEDULE = lessons;
                        console.log('Ders programı Sheet\'ten yüklendi:', lessons.length, 'ders');
                    }
                }
            } catch(e) { console.warn('Ders programı okunamadı, varsayılan kullanılıyor'); }
            delete window.kioskLessonsCallback;
        };
        const s = document.createElement('script'); s.id = scriptId; s.src = url;
        s.onerror = () => { delete window.kioskLessonsCallback; };
        document.body.appendChild(s);
    }

    function fetchDutyTeachers(sheetId) {
        const dayCol = getDayColumnIndex();
        if (dayCol === 0) return; // Hafta sonu

        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler=kioskTeachersCallback&sheet=NOBETCI_OGRETMEN&headers=1&t=${Date.now()}`;
        const scriptId = 'jsonp-kiosk-teachers';
        let old = document.getElementById(scriptId); if (old) old.remove();

        window.kioskTeachersCallback = function(json) {
            try {
                const rows = json.table.rows;
                if (rows && rows.length > 0) {
                    const teachers = rows.map(r => {
                        const floor = r.c[0] ? (r.c[0].v || '').toString().trim() : '';
                        const name = r.c[dayCol] ? (r.c[dayCol].v || '').toString().trim() : '—';
                        return { floor, name };
                    }).filter(t => t.floor);
                    if (teachers.length > 0) {
                        renderDutyTeachers(teachers);
                        console.log('Nöbetçi öğretmenler Sheet\'ten yüklendi:', teachers.length);
                    }
                }
            } catch(e) { console.warn('Nöbetçi öğretmenler okunamadı'); }
            delete window.kioskTeachersCallback;
        };
        const s = document.createElement('script'); s.id = scriptId; s.src = url;
        s.onerror = () => { delete window.kioskTeachersCallback; };
        document.body.appendChild(s);
    }

    function fetchDutyStudents(sheetId) {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler=kioskStudentsCallback&sheet=NOBETCI_OGRENCI&headers=1&t=${Date.now()}`;
        const scriptId = 'jsonp-kiosk-students';
        let old = document.getElementById(scriptId); if (old) old.remove();

        const today = getTodayStrForKiosk();

        window.kioskStudentsCallback = function(json) {
            try {
                const rows = json.table.rows;
                if (rows && rows.length > 0) {
                    const students = rows.map(r => {
                        const tarih = r.c[0] ? (r.c[0].f || r.c[0].v || '').toString().trim() : '';
                        const sinif = r.c[1] ? (r.c[1].v || '').toString().trim() : '';
                        const ad = r.c[2] ? (r.c[2].v || '').toString().trim() : '';
                        return { tarih, className: sinif, name: ad };
                    }).filter(s => s.tarih === today && s.name);
                    renderDutyStudents(students);
                    console.log('Nöbetçi öğrenciler Sheet\'ten yüklendi:', students.length);
                }
            } catch(e) { console.warn('Nöbetçi öğrenciler okunamadı'); }
            delete window.kioskStudentsCallback;
        };
        const s = document.createElement('script'); s.id = scriptId; s.src = url;
        s.onerror = () => { delete window.kioskStudentsCallback; };
        document.body.appendChild(s);
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function formatCountdown(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateLessonInfo() {
        if (!els.lessonPeriod || !els.lessonCountdown) return;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = currentMinutes * 60 + now.getSeconds();

        // Hafta sonu kontrolü (0=Pazar, 6=Cumartesi)
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            setLessonOffHours('Hafta Sonu', 'Ders yok');
            return;
        }

        let foundLesson = false;

        for (let i = 0; i < LESSON_SCHEDULE.length; i++) {
            const lesson = LESSON_SCHEDULE[i];
            const startMin = timeToMinutes(lesson.start);
            const endMin = timeToMinutes(lesson.end);
            const startSec = startMin * 60;
            const endSec = endMin * 60;

            // Ders saatindeyiz
            if (currentSeconds >= startSec && currentSeconds < endSec) {
                foundLesson = true;
                const remaining = endSec - currentSeconds;

                els.lessonPeriod.textContent = `${lesson.period}. Ders`;
                els.lessonStatus.textContent = `${lesson.start} — ${lesson.end}`;
                els.lessonCountdownLabel.textContent = 'Teneffüse Kalan';
                els.lessonCountdown.textContent = formatCountdown(remaining);

                // Progress
                const totalDuration = endSec - startSec;
                const elapsed = currentSeconds - startSec;
                const progress = (elapsed / totalDuration) * 100;
                if (els.lessonProgressFill) els.lessonProgressFill.style.width = `${progress}%`;

                // Urgent mode (son 2 dk)
                if (remaining <= 120) {
                    els.lessonCountdown.classList.add('urgent');
                } else {
                    els.lessonCountdown.classList.remove('urgent');
                }

                // Card state
                if (els.lessonCard) {
                    els.lessonCard.classList.remove('break-time', 'off-hours');
                }
                break;
            }

            // Teneffüsteyiz (bu ders bitti, sonraki başlamadı)
            if (i < LESSON_SCHEDULE.length - 1) {
                const nextLesson = LESSON_SCHEDULE[i + 1];
                const nextStartMin = timeToMinutes(nextLesson.start);
                const nextStartSec = nextStartMin * 60;

                if (currentSeconds >= endSec && currentSeconds < nextStartSec) {
                    foundLesson = true;
                    const remaining = nextStartSec - currentSeconds;

                    els.lessonPeriod.textContent = 'Teneffüs';
                    els.lessonStatus.textContent = `${lesson.period}. ders bitti`;
                    els.lessonCountdownLabel.textContent = `${nextLesson.period}. Derse Kalan`;
                    els.lessonCountdown.textContent = formatCountdown(remaining);
                    els.lessonCountdown.classList.remove('urgent');

                    // Progress (teneffüs ilerlemesi)
                    const breakDuration = nextStartSec - endSec;
                    const breakElapsed = currentSeconds - endSec;
                    const progress = (breakElapsed / breakDuration) * 100;
                    if (els.lessonProgressFill) els.lessonProgressFill.style.width = `${progress}%`;

                    // Card state
                    if (els.lessonCard) {
                        els.lessonCard.classList.remove('off-hours');
                        els.lessonCard.classList.add('break-time');
                    }
                    break;
                }
            }
        }

        if (!foundLesson) {
            // Öğleden sonra mola kontrolü (12:30 - 13:10)
            const lunchStart = timeToMinutes('12:30');
            const lunchEnd = timeToMinutes('13:10');
            if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) {
                const remaining = (lunchEnd * 60) - currentSeconds;
                els.lessonPeriod.textContent = 'Öğle Arası';
                els.lessonStatus.textContent = '12:30 — 13:10';
                els.lessonCountdownLabel.textContent = '6. Derse Kalan';
                els.lessonCountdown.textContent = formatCountdown(remaining);
                els.lessonCountdown.classList.remove('urgent');

                const breakDuration = (lunchEnd - lunchStart) * 60;
                const breakElapsed = currentSeconds - (lunchStart * 60);
                const progress = (breakElapsed / breakDuration) * 100;
                if (els.lessonProgressFill) els.lessonProgressFill.style.width = `${progress}%`;

                if (els.lessonCard) {
                    els.lessonCard.classList.remove('off-hours');
                    els.lessonCard.classList.add('break-time');
                }
            } else if (currentMinutes < timeToMinutes(LESSON_SCHEDULE[0].start)) {
                setLessonOffHours('Ders Öncesi', `İlk ders ${LESSON_SCHEDULE[0].start}\'de`);
            } else {
                setLessonOffHours('Dersler Bitti', 'Yarın görüşmek üzere');
            }
        }
    }

    function setLessonOffHours(periodText, statusText) {
        els.lessonPeriod.textContent = periodText;
        els.lessonStatus.textContent = statusText;
        els.lessonCountdownLabel.textContent = '';
        els.lessonCountdown.textContent = '—';
        els.lessonCountdown.classList.remove('urgent');
        if (els.lessonProgressFill) els.lessonProgressFill.style.width = '0%';
        if (els.lessonCard) {
            els.lessonCard.classList.remove('break-time');
            els.lessonCard.classList.add('off-hours');
        }
    }

    function renderDutyTeachers(teachers) {
        if (!els.dutyTeachersList) return;
        els.dutyTeachersList.innerHTML = teachers.map(t => `
            <div class="duty-item">
                <div class="duty-item-badge">${escapeHtml(t.floor.charAt(0))}</div>
                <div class="duty-item-info">
                    <div class="duty-item-name">${escapeHtml(t.name)}</div>
                    <div class="duty-item-detail">${escapeHtml(t.floor)}</div>
                </div>
            </div>
        `).join('');
    }

    function renderDutyStudents(students) {
        if (!els.dutyStudentsList) return;
        if (!students || students.length === 0) {
            els.dutyStudentsList.innerHTML = '<div style="text-align:center; padding:12px 0; color:#64748b; font-size:12px; font-weight:600;">Henüz kayıt yok</div>';
            return;
        }
        els.dutyStudentsList.innerHTML = students.map(s => `
            <div class="duty-item">
                <div class="duty-item-badge">${escapeHtml(s.className)}</div>
                <div class="duty-item-info">
                    <div class="duty-item-name">${escapeHtml(s.name)}</div>
                    <div class="duty-item-detail">Sınıf: ${escapeHtml(s.className)}</div>
                </div>
            </div>
        `).join('');
    }

    // --- İNTERNET DURUMU DİNLEYİCİLERİ ---
    window.addEventListener('online', () => {
        if (els.offlineBadge) els.offlineBadge.classList.add('hidden');
    });
    
    window.addEventListener('offline', () => {
        if (els.offlineBadge) els.offlineBadge.classList.remove('hidden');
    });

    document.addEventListener('DOMContentLoaded', init);
})();
