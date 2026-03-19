/* ============================================
   TV KIOSK - APP.JS v8 (Universal Magic Link & Excel Database)
   In-Card Cinematic Edition - 2sn Bekleme
   ============================================ */

(function () {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        SLIDE_INTERVAL: 10000,      // Normal slaytlar için bekleme süresi
        DATA_REFRESH: 120000,       // 2 dakikada bir Excel'i kontrol eder
        CLOCK_REFRESH: 1000,        
        PROGRESS_STEP: 50,          
        TICKER_CYCLE: 6000,         
        TICKER_SCROLL_SPEED: 70,    
        WEATHER_REFRESH: 600000,    
        WEATHER_CITY: 'Sultangazi', // Excel'den okuyamazsa varsayılan
        WEATHER_LAT: 41.1075,       // Excel'den okuyamazsa varsayılan
        WEATHER_LON: 28.8617,       // Excel'den okuyamazsa varsayılan
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
        .slide-media::after { transition: opacity 0.5s ease; }
        .fullscreen-media { width: 100% !important; }
        .fullscreen-media::after { opacity: 0 !important; }
        .slide-text { transition: opacity 0.5s ease; }
        .text-hidden { opacity: 0 !important; }
    `;
    document.head.appendChild(dynamicStyle);

    // --- YouTube API Setup ---
    window.ytApiReady = false;
    window.ytPlayers = {};
    window.currentYtStateCallback = null;

    window.onYouTubeIframeAPIReady = function() {
        window.ytApiReady = true;
        initYouTubePlayers();
    };

    const ytScript = document.createElement('script');
    ytScript.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag) firstScriptTag.parentNode.insertBefore(ytScript, firstScriptTag);
    else document.head.appendChild(ytScript);

    function onPlayerStateChange(event) {
        if (window.currentYtStateCallback) window.currentYtStateCallback(event.data);
    }

    // --- Category Mappings ---
    const CATEGORY_MAP = {
        'duyuru':     { icon: '📋', class: 'cat-duyuru',   label: 'Duyuru' },
        'etkinlik':   { icon: '🎉', class: 'cat-etkinlik', label: 'Etkinlik' },
        'sinav':      { icon: '📝', class: 'cat-sinav',    label: 'Sınav' },
        'sınav':      { icon: '📝', class: 'cat-sinav',    label: 'Sınav' },
        'onemli':     { icon: '🔴', class: 'cat-onemli',   label: 'Önemli' },
        'önemli':     { icon: '🔴', class: 'cat-onemli',   label: 'Önemli' },
        'acil':       { icon: '🚨', class: 'cat-onemli',   label: 'Acil' },
        'spor':       { icon: '⚽', class: 'cat-etkinlik', label: 'Spor' },
        'bilim':      { icon: '🔬', class: 'cat-etkinlik', label: 'Bilim' },
        'teknoloji':  { icon: '💻', class: 'cat-etkinlik', label: 'Teknoloji' },
        'toplantı':   { icon: '👥', class: 'cat-duyuru',   label: 'Toplantı' },
        'kutlama':    { icon: '🎊', class: 'cat-etkinlik', label: 'Kutlama' },
    };
    const DEFAULT_CATEGORY = { icon: '📌', class: 'cat-default', label: 'Bilgi' };

    const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    // --- State ---
    let slides = [];
    let tickerItems = [];
    let currentSlideIndex = 0;
    let currentSlideTimeout = null;
    let progressTimer = null;
    let nextPreviewTimer = null;
    let fullscreenTriggerTimer = null;
    let retryCount = 0;

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

    function init() {
        cacheDom();
        const urlParams = new URLSearchParams(window.location.search);

        // ==========================================
        // 🌟 SİHİRLİ LİNK KONTROLÜ (MAGIC LINK)
        // Eğer linkte ?id=... varsa, bunu kalıcı olarak TV'nin hafızasına kaydet
        if (urlParams.has('id')) {
            const urlId = urlParams.get('id');
            if (urlId && urlId.trim() !== '') {
                localStorage.setItem('kiosk_sheet_id', urlId.trim());
            }
        }
        // ==========================================

        const isDemo = urlParams.has('demo') || localStorage.getItem('kiosk_demo_mode') === 'true';
        if (isDemo) { startDemoMode(); return; }

        // Hafızadaki ID'yi çağır (Linkten kopyaladığı veya daha önce girilmiş olan)
        const sheetId = localStorage.getItem('kiosk_sheet_id');

        // Eğer hiçbir ID bulunamadıysa kurulum ekranını göster
        if (!sheetId) { showSetupPrompt(); return; }

        startClock();
        
        // Önce AYARLAR sekmesini, sonra DUYURULAR sekmesini çeken ana fonksiyon
        fetchSettingsAndData(sheetId);
        
        // Zamanlayıcılar
        setInterval(() => fetchSettingsAndData(sheetId), CONFIG.DATA_REFRESH);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);
    }

    function startDemoMode() {
        els.schoolName.textContent = 'Gazi Mesleki ve Teknik Anadolu Lisesi';
        startClock(); fetchFreeWeather();
        const demoRows = [
            {
                baslik: '2025-2026 Bahar Dönemi Kayıt Yenileme',
                icerik: 'Tüm öğrencilerimizin 1-15 Mart tarihleri arasında e-Okul sistemi üzerinden kayıt yenilemelerini tamamlamaları gerekmektedir. Gerekli belgeler okul web sitesinde yayınlanmıştır.',
                kategori: 'duyuru',
                tarih: '2026-03-01',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://picsum.photos/id/180/800/600',
                video: ''
            },
            {
                baslik: 'Bilim ve Teknoloji Şenliği Başlıyor!',
                icerik: 'Okulumuzun geleneksel Bilim Şenliği 25 Mart\'ta spor salonunda başlıyor. Robotik, yapay zeka ve yenilenebilir enerji alanlarında projeler sergilenecek. Tüm velilerimiz davetlidir!',
                kategori: 'bilim',
                tarih: '2026-03-25',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://picsum.photos/id/2/800/600',
                video: ''
            },
            {
                baslik: 'Yarıyıl Sınavları Programı Açıklandı',
                icerik: 'İkinci dönem yazılı sınavları 7-18 Nisan tarihleri arasında yapılacaktır. Sınav programı kat panolarına asılmıştır. Öğrencilerimize başarılar dileriz.',
                kategori: 'sinav',
                tarih: '2026-04-07',
                aktif: 'evet',
                bant: 'hayır',
                gorsel: '',
                video: ''
            },
            {
                baslik: '🏆 Okulumuz İl Birincisi!',
                icerik: 'Bilgisayar Programcılığı bölümü öğrencilerimiz TÜBİTAK proje yarışmasında il birincisi olmuştur! Fatih Yılmaz ve Ayşe Kara\'yı tebrik ediyoruz.',
                kategori: 'onemli',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://picsum.photos/id/60/800/600',
                video: ''
            },
            {
                baslik: 'Okul Spor Turnuvaları Devam Ediyor',
                icerik: 'Sınıflar arası futbol turnuvasında çeyrek final maçları bu hafta oynanacak. Voleybol turnuvası kayıtları da başlamıştır. Beden Eğitimi öğretmenlerine başvurabilirsiniz.',
                kategori: 'spor',
                tarih: '2026-03-20',
                aktif: 'evet',
                bant: 'hayır',
                gorsel: 'https://picsum.photos/id/235/800/600',
                video: ''
            },
            {
                baslik: 'Kariyer Günleri: Sektörden Konuklar',
                icerik: 'Her Cuma günü farklı sektörlerden profesyoneller okulumuza konuk oluyor. Bu hafta konuğumuz yazılım mühendisi Mehmet Demir. Konferans salonunda, saat 14:00\'te.',
                kategori: 'etkinlik',
                tarih: '2026-03-21',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://picsum.photos/id/3/800/600',
                video: ''
            },
            {
                baslik: 'Kütüphane Yeni Kitaplar Eklendi',
                icerik: 'Okul kütüphanemize 200 yeni kitap eklendi. Bilim kurgu, tarih ve teknoloji alanlarında zengin bir koleksiyon sizi bekliyor. Kütüphane her gün 08:30 - 17:00 arası açıktır.',
                kategori: 'duyuru',
                tarih: '2026-03-18',
                aktif: 'evet',
                bant: 'hayır',
                gorsel: 'https://picsum.photos/id/24/800/600',
                video: ''
            },
            {
                baslik: 'Deprem Tatbikatı Hatırlatması',
                icerik: '22 Mart Cuma günü saat 10:00\'da okul genelinde deprem tatbikatı yapılacaktır. Tüm öğrenci ve personelin tatbikat prosedürlerini gözden geçirmesi rica olunur.',
                kategori: 'onemli',
                tarih: '2026-03-22',
                aktif: 'evet',
                bant: 'evet',
                gorsel: '',
                video: ''
            }
        ];
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

    function loadFromCache() {
        if (els.offlineBadge) els.offlineBadge.classList.remove('hidden');
        const cachedData = localStorage.getItem('cachedAnnouncements');
        if (cachedData) {
            try { processData(JSON.parse(cachedData)); } catch (e) { showError('Önbellek bozuk.'); }
        } else {
            showError('İnternet bağlantısı yok.');
        }
    }

    // ==========================================
    // EXCEL'DEN AYARLARI VE DUYURULARI ÇEKME
    // ==========================================
    function fetchSettingsAndData(sheetId) {
        const id = getCleanSheetId(sheetId);
        
        // 1. AŞAMA: AYARLAR SEKMESİNİ OKU
        const settingsUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetSettings&sheet=AYARLAR`;
        
        let oldSettingsScript = document.getElementById('jsonp-settings-fetch');
        if (oldSettingsScript) oldSettingsScript.remove();

        window.parseGoogleSheetSettings = function(json) {
            try {
                const rows = json.table.rows;
                const settings = {};
                
                rows.forEach(row => {
                    if(row.c && row.c[0] && row.c[1]) {
                        const key = row.c[0].v ? row.c[0].v.toString().trim() : '';
                        const val = row.c[1].v ? row.c[1].v.toString().trim() : '';
                        settings[key] = val;
                    }
                });

                // Ayarları Ekrana Uygula
                if (settings['OkulAdi']) {
                    els.schoolName.textContent = settings['OkulAdi'];
                    document.title = settings['OkulAdi'] + ' — Bilgi Ekranı';
                }
                
                if (settings['LogoURL'] && els.schoolLogo) {
                    els.schoolLogo.src = settings['LogoURL'];
                    els.schoolLogo.style.display = 'block';
                    if (els.defaultSchoolIcon) els.defaultSchoolIcon.style.display = 'none';
                } else if (!settings['LogoURL'] && els.schoolLogo) {
                    els.schoolLogo.style.display = 'none';
                    if (els.defaultSchoolIcon) els.defaultSchoolIcon.style.display = 'block';
                }

                // Koordinatları ayarla
                if (settings['Enlem']) CONFIG.WEATHER_LAT = parseFloat(settings['Enlem'].replace(',', '.'));
                if (settings['Boylam']) CONFIG.WEATHER_LON = parseFloat(settings['Boylam'].replace(',', '.'));
                
                // Şehir ayarını uygula
                if (settings['Sehir']) {
                    CONFIG.WEATHER_CITY = settings['Sehir'];
                    localStorage.setItem('kiosk_weather_city', settings['Sehir']);
                }

                // Script URL'yi AYARLAR'dan kaydet (TV kurulumunu basitleştirir)
                if (settings['ScriptURL']) {
                    localStorage.setItem('kiosk_script_url', settings['ScriptURL']);
                }

                // Şifreyi AYARLAR'dan kaydet
                if (settings['Sifre']) {
                    localStorage.setItem('kiosk_admin_password', settings['Sifre']);
                }

                // Okul adını da localStorage'a kaydet
                if (settings['OkulAdi']) {
                    localStorage.setItem('kiosk_school_name', settings['OkulAdi']);
                }

                fetchWeather(); // Yeni koordinatlara göre havayı çek

            } catch(e) { console.error("Ayarlar okunamadı, varsayılanlar kullanılacak."); }
            
            delete window.parseGoogleSheetSettings;

            // 2. AŞAMA: AYARLAR BİTTİKTEN SONRA DUYURULARI OKU
            fetchData(sheetId);
        };

        const scriptSettings = document.createElement('script');
        scriptSettings.id = 'jsonp-settings-fetch';
        scriptSettings.src = settingsUrl;
        scriptSettings.onerror = function() { fetchData(sheetId); }; 
        document.body.appendChild(scriptSettings);
    }

    function fetchData(sheetId) {
        const id = getCleanSheetId(sheetId);
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetData&sheet=DUYURULAR`;
        const scriptId = 'jsonp-sheet-fetch';
        
        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();
        
        window.parseGoogleSheetData = function(json) {
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
            } catch(e) { loadFromCache(); }
            delete window.parseGoogleSheetData;
        };
        
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        script.onerror = function() {
            retryCount++;
            if (retryCount <= CONFIG.MAX_RETRIES) setTimeout(() => fetchSettingsAndData(sheetId), CONFIG.RETRY_DELAY);
            else loadFromCache();
        };
        document.body.appendChild(script);
    }

    function getMediaType(url) {
        if (!url) return null;
        const lower = url.toLowerCase();
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
        if (lower.includes('drive.google.com')) return 'drive';
        if (['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext))) return 'video';
        return 'image';
    }

    function getYouTubeId(url) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
        return match ? match[1] : null;
    }

    function getDriveFileId(url) {
        // Supports: /file/d/FILE_ID/..., ?id=FILE_ID, /d/FILE_ID
        const match = url.match(/(?:\/file\/d\/|\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    function processData(rows) {
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
        } else if (item.mediaType === 'drive') {
            const driveId = getDriveFileId(item.mediaUrl);
            if (!driveId) return '';
            return `<div class="slide-media drive-container" id="media-container-${index}">
                <iframe id="drive-player-${index}" src="https://drive.google.com/file/d/${driveId}/preview" 
                    style="width:100%;height:100%;border:none;pointer-events:none;" 
                    allow="autoplay" allowfullscreen></iframe>
            </div>`;
        }
        return '';
    }

    function renderSlides() {
        els.slidesContainer.innerHTML = '';
        slides.forEach((item, index) => {
            const slideEl = document.createElement('div');
            slideEl.className = `slide ${index === 0 ? 'active' : ''}`;
            const hasMedia = item.mediaUrl && item.mediaType;
            const noMediaClass = hasMedia ? '' : 'no-media';
            
            const progressHtml = (item.mediaType === 'youtube' || item.mediaType === 'video' || item.mediaType === 'drive') 
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
        
        for (let idx in window.ytPlayers) {
            if (!document.getElementById(`yt-player-${idx}`)) {
                try { window.ytPlayers[idx].destroy(); } catch(e){}
                delete window.ytPlayers[idx];
            }
        }

        document.querySelectorAll('[id^="yt-player-"]').forEach(el => {
            let vid = el.getAttribute('data-vid');
            let idx = el.id.replace('yt-player-', '');
            if (window.ytPlayers[idx]) return;

            window.ytPlayers[idx] = new YT.Player(el.id, {
                videoId: vid,
                playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, mute: 1, showinfo: 0, disablekb: 1 },
                events: { 'onStateChange': onPlayerStateChange }
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
        scheduleNextPreview();
        playCurrentSlide();
    }

    function playCurrentSlide() {
        if (currentSlideTimeout) clearTimeout(currentSlideTimeout);
        if (progressTimer) clearInterval(progressTimer);
        document.querySelectorAll('.slide-progress').forEach(bar => { bar.style.width = '0%'; bar.style.transition = 'none'; });

        const item = slides[currentSlideIndex];
        if (!item) return;

        if (item.mediaType === 'youtube' || item.mediaType === 'video' || item.mediaType === 'drive') {
            handleVideoSlide(item, currentSlideIndex);
        } else {
            startProgress(CONFIG.SLIDE_INTERVAL);
            currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL);
        }
    }

    function handleVideoSlide(item, index) {
        const container = document.getElementById(`media-container-${index}`);
        if (!container) { currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL); return; }

        const textElement = container.closest('.slide-card').querySelector('.slide-text');

        // Temizle
        container.classList.remove('fullscreen-media');
        if(textElement) textElement.classList.remove('text-hidden');

        if (item.mediaType === 'youtube') {
            const playerObj = window.ytPlayers[index];
            if (!window.ytApiReady || !playerObj || typeof playerObj.playVideo !== 'function') {
                currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL); return;
            }

            // Watchdog: Eğer video API tarafından engellenir ve 8 saniye boyunca hiç başlamazsa atla
            let watchdogTimer = setTimeout(() => {
                if (playerObj.getPlayerState() !== 1) {
                    console.warn('YouTube video blocked by TV browser, skipping...');
                    nextSlide();
                }
            }, 8000);

            let didSetDuration = false;

            window.currentYtStateCallback = (state) => {
                if (state === 1) { // Video Oynatılıyor
                    clearTimeout(watchdogTimer);
                    playerObj.unMute(); 
                    
                    // Sonsuz oynamayı önlemek için maksimum bir bitiş süresi garantile
                    if (!didSetDuration) {
                        didSetDuration = true;
                        let duration = playerObj.getDuration() || 60; // Bilinmiyorsa 60 sn
                        currentSlideTimeout = setTimeout(() => {
                            if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                            else nextSlide();
                        }, (duration + 2) * 1000); // videonun kendi süresi + 2 sn tolerans
                    }
                }
                if (state === 0) { // Video Bitti
                    clearTimeout(currentSlideTimeout);
                    if (fullscreenTriggerTimer) clearTimeout(fullscreenTriggerTimer);
                    if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                    else nextSlide();
                }
            };
            
            playerObj.seekTo(0);
            playerObj.playVideo();

        } else if (item.mediaType === 'video') {
            const playerObj = document.getElementById(`html-video-${index}`);
            if (playerObj) {
                playerObj.muted = true; // Engellemeyi aşmak için
                playerObj.currentTime = 0;
                
                // Watchdog for HTML video (in case promise hangs)
                let watchdogTimer = setTimeout(() => {
                    nextSlide();
                }, 8000);

                playerObj.play().then(() => {
                    clearTimeout(watchdogTimer);
                    playerObj.muted = false; // Başarılıysa sesi aç
                    
                    let duration = playerObj.duration || 60;
                    currentSlideTimeout = setTimeout(() => {
                        if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                        else nextSlide();
                    }, (duration + 2) * 1000);

                }).catch(e => {
                    console.log('Video error:', e);
                    clearTimeout(watchdogTimer);
                    currentSlideTimeout = setTimeout(nextSlide, 5000);
                });

                playerObj.onended = () => {
                    clearTimeout(currentSlideTimeout);
                    if (fullscreenTriggerTimer) clearTimeout(fullscreenTriggerTimer);
                    if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                    else nextSlide();
                };
            }
        } else if (item.mediaType === 'drive') {
            // Drive video: iframe olarak gösterilir, süre sınırlı (30 saniye)
            const driveTimeout = 30000;
            currentSlideTimeout = setTimeout(() => {
                if (container.classList.contains('fullscreen-media')) endVideoSlide(container, textElement);
                else nextSlide();
            }, driveTimeout);
        }

        // 1. Adım: 4 saniye normal bekle, sonra bulunduğu kartın içinde %100 genişle
        fullscreenTriggerTimer = setTimeout(() => {
            container.classList.add('fullscreen-media');
            if(textElement) textElement.classList.add('text-hidden');
        }, 4000);
    }

    function endVideoSlide(container, textElement) {
        // 3. Adım: Bittiğinde küçült ve yazıyı geri getir
        container.classList.remove('fullscreen-media');
        if(textElement) textElement.classList.remove('text-hidden');
        
        // 4. Adım: Küçülme animasyonunun bitmesini bekle (2 Saniye)
        currentSlideTimeout = setTimeout(() => {
            nextSlide();
        }, 2000); 
    }

    function nextSlide() {
        if (currentSlideTimeout) clearTimeout(currentSlideTimeout);
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
        scheduleNextPreview();
        playCurrentSlide();
    }

    function stopSlideMedia(index) {
        const item = slides[index];
        if (!item) return;
        const container = document.getElementById(`media-container-${index}`);
        if(container) {
            container.classList.remove('fullscreen-media');
            const textElement = container.closest('.slide-card').querySelector('.slide-text');
            if(textElement) textElement.classList.remove('text-hidden');
        }

        if (item.mediaType === 'youtube' && window.ytPlayers[index] && typeof window.ytPlayers[index].pauseVideo === 'function') {
            window.ytPlayers[index].pauseVideo();
        } else if (item.mediaType === 'video') {
            const video = document.getElementById(`html-video-${index}`);
            if (video) video.pause();
        } else if (item.mediaType === 'drive') {
            // Drive iframe'i durdurmak için src'yi temizleyip geri yükle
            const iframe = document.getElementById(`drive-player-${index}`);
            if (iframe) {
                const src = iframe.src;
                iframe.src = '';
                iframe.src = src;
            }
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

        if (slides[currentSlideIndex].mediaType !== 'image' && slides[currentSlideIndex].mediaUrl === '') return;
        
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
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LAT}&longitude=${CONFIG.WEATHER_LON}&current_weather=true`)
            .then(r => r.json())
            .then(data => {
                if (data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    if (els.weatherTemp) els.weatherTemp.textContent = `${temp}°C`;
                    if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY;
                    if (els.weatherDesc) els.weatherDesc.textContent = 'Güncel';
                }
            }).catch(() => {});
    }
    function fetchWeather() { fetchFreeWeather(); }

    // --- TV Universal Scaling ---
    function updateScale() {
        const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        document.documentElement.style.setProperty('--tv-scale', scale);
    }
    window.addEventListener('resize', updateScale);
    updateScale();

    document.addEventListener('DOMContentLoaded', init);
})();
