/* ============================================
   TV KIOSK - APP.JS v3
   Google Sheets Integration & Slide Engine
   Cinematic Edition — Video/Image Support
   ============================================ */

(function () {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        SLIDE_INTERVAL: 10000,      // 10 seconds per slide
        DATA_REFRESH: 120000,       // 2 minutes data refresh
        CLOCK_REFRESH: 1000,        // 1 second clock update
        PROGRESS_STEP: 50,          // Progress bar update interval (ms)
        TICKER_CYCLE: 6000,         // 6 seconds per ticker item (fade mode)
        TICKER_SCROLL_SPEED: 70,    // pixels per second for scroll mode
        WEATHER_REFRESH: 600000,    // 10 minutes weather refresh
        WEATHER_CITY: 'Sultangazi',
        WEATHER_LAT: 41.1075,
        WEATHER_LON: 28.8617,
        NEXT_PREVIEW_SHOW: 3000,    // Show "next" preview 3 sec before transition
        RETRY_DELAY: 10000,
        MAX_RETRIES: 5,
    };

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
        'müzik': { icon: '🎵', class: 'cat-etkinlik', label: 'Müzik' },
        'muzik': { icon: '🎵', class: 'cat-etkinlik', label: 'Müzik' },
        'sanat': { icon: '🎨', class: 'cat-etkinlik', label: 'Sanat' },
        'bilim': { icon: '🔬', class: 'cat-etkinlik', label: 'Bilim' },
        'teknoloji': { icon: '💻', class: 'cat-etkinlik', label: 'Teknoloji' },
        'mezuniyet': { icon: '🎓', class: 'cat-etkinlik', label: 'Mezuniyet' },
        'toplantı': { icon: '👥', class: 'cat-duyuru', label: 'Toplantı' },
        'toplanti': { icon: '👥', class: 'cat-duyuru', label: 'Toplantı' },
        'kutlama': { icon: '🎊', class: 'cat-etkinlik', label: 'Kutlama' },
        'yarışma': { icon: '🏆', class: 'cat-etkinlik', label: 'Yarışma' },
        'yarisma': { icon: '🏆', class: 'cat-etkinlik', label: 'Yarışma' },
        'gezi': { icon: '🚌', class: 'cat-etkinlik', label: 'Gezi' },
        'seminer': { icon: '🎤', class: 'cat-duyuru', label: 'Seminer' },
    };

    const DEFAULT_CATEGORY = { icon: '📌', class: 'cat-default', label: 'Bilgi' };

    // --- Turkish Date Helpers ---
    const TR_MONTHS = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const TR_DAYS = [
        'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
    ];

    // --- State ---
    let slides = [];
    let tickerItems = [];
    let currentSlideIndex = 0;
    let slideTimer = null;
    let progressTimer = null;
    let nextPreviewTimer = null;
    let retryCount = 0;

    // --- DOM Elements ---
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
        els.eventBanner = document.getElementById('event-banner');
        els.eventBannerText = document.getElementById('event-banner-text');
        els.eventBannerBadge = document.getElementById('event-banner-badge');
        els.nextPreview = document.getElementById('next-slide-preview');
        els.nextPreviewTitle = document.getElementById('next-preview-title');
    }

    // --- Init ---
    function init() {
        cacheDom();

        const urlParams = new URLSearchParams(window.location.search);
        const isDemo = urlParams.has('demo') || localStorage.getItem('kiosk_demo_mode') === 'true';

        if (isDemo) {
            startDemoMode();
            return;
        }

        const sheetId = localStorage.getItem('kiosk_sheet_id');
        const schoolName = localStorage.getItem('kiosk_school_name');
        const schoolLogo = localStorage.getItem('kiosk_school_logo');
        const weatherCity = localStorage.getItem('kiosk_weather_city');

        if (!sheetId) {
            showSetupPrompt();
            return;
        }

        if (schoolName) {
            els.schoolName.textContent = schoolName;
            document.title = schoolName + ' — Bilgi Ekranı';
        }

        if (schoolLogo && els.schoolLogo) {
            els.schoolLogo.src = schoolLogo;
            els.schoolLogo.style.display = 'block';
            if (els.defaultSchoolIcon) {
                els.defaultSchoolIcon.style.display = 'none';
            }
        }

        if (weatherCity) {
            CONFIG.WEATHER_CITY = weatherCity;
        }
        const weatherLat = localStorage.getItem('kiosk_weather_lat');
        const weatherLon = localStorage.getItem('kiosk_weather_lon');
        if (weatherLat && weatherLon) {
            CONFIG.WEATHER_LAT = parseFloat(weatherLat);
            CONFIG.WEATHER_LON = parseFloat(weatherLon);
        }

        startClock();
        fetchWeather();
        fetchData(sheetId);
        setInterval(() => fetchData(sheetId), CONFIG.DATA_REFRESH);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);
    }

    // --- Demo Mode ---
    function startDemoMode() {
        const schoolName = 'Gazi MTAL';
        els.schoolName.textContent = schoolName;
        document.title = schoolName + ' — Bilim Şenliği Bilgi Ekranı';

        if (els.eventBanner) {
            els.eventBanner.classList.remove('hidden');
            els.eventBannerText.textContent = '🎉 Gazi MTAL Bilim Şenliği • Okul Spor Salonu';
            els.eventBannerBadge.textContent = 'DEVAM EDİYOR';
        }

        startClock();
        setDemoWeather();

        const demoRows = [
            {
                baslik: 'Bilim Şenliği\'ne Hoş Geldiniz!',
                icerik: 'Gazi MTAL olarak düzenlediğimiz Bilim Şenliği etkinliğimize tüm öğrenci, veli ve misafirlerimizi bekliyoruz. Etkinlik okul spor salonumuzda gerçekleştirilmektedir.',
                kategori: 'etkinlik',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'evet',
                gorsel: '',
                video: '',
            },
            {
                baslik: 'Robotik Projeleri Sergisi',
                icerik: 'Arduino ve Raspberry Pi tabanlı robotik projelerimiz spor salonunun A bölümünde sergilenmektedir. Öğrencilerimizin hazırladığı otonom robotları yakından inceleyin!',
                kategori: 'bilim',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'hayir',
                gorsel: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
                video: '',
            },
            {
                baslik: 'Kimya Deneyleri Gösterisi',
                icerik: 'Saat 14:00-15:30 arasında spor salonunun B bölümünde canlı kimya deneyleri yapılacaktır. Renkli reaksiyonlar ve sıvı azot gösterileri sizi bekliyor!',
                kategori: 'bilim',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop',
                video: '',
            },
            {
                baslik: 'Matematik Olimpiyat Sonuçları',
                icerik: 'Bu yılki matematik olimpiyatında okulumuzdan 3 öğrenci derece aldı. Tebrikler! Ödül töreni bilim şenliği kapanış programında yapılacaktır.',
                kategori: 'duyuru',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'evet',
                gorsel: '',
                video: '',
            },
            {
                baslik: 'Sınav Programı Değişikliği',
                icerik: 'Bilim Şenliği nedeniyle 15 Mart Cumartesi günü planlanan telafi sınavları 17 Mart Pazartesi gününe ertelenmiştir. Öğrencilerimizin dikkatine!',
                kategori: 'sinav',
                tarih: '2026-03-17',
                aktif: 'evet',
                bant: 'evet',
                gorsel: '',
                video: '',
            },
            {
                baslik: 'Gönüllü Öğrenci Rehberleri',
                icerik: 'Bilim Şenliği boyunca etkinlik alanında mavi yelek giyen öğrenci rehberlerimiz size yardımcı olacaktır. Sorularınız için onlara danışabilirsiniz.',
                kategori: 'onemli',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'hayir',
                gorsel: '',
                video: '',
            },
            {
                baslik: 'Yıldızlar ve Gezegenler',
                icerik: 'Astronomi kulübümüzün hazırladığı güneş sistemi maketi ve teleskop gözlem alanı C bölümünde sizleri bekliyor!',
                kategori: 'etkinlik',
                tarih: '2026-03-15',
                aktif: 'evet',
                bant: 'evet',
                gorsel: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=600&fit=crop',
                video: '',
            },
        ];

        processData(demoRows);
    }

    function setDemoWeather() {
        fetchFreeWeather();
    }

    function showSetupPrompt() {
        els.setupPrompt.classList.remove('hidden');
        els.mainDisplay.classList.add('hidden');
    }

    // --- Clock (HH:MM only, no seconds) ---
    function startClock() {
        updateClock();
        setInterval(updateClock, CONFIG.CLOCK_REFRESH);
    }

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        els.time.textContent = `${hours}:${minutes}`;

        const day = now.getDate();
        const month = TR_MONTHS[now.getMonth()];
        const year = now.getFullYear();
        const dayName = TR_DAYS[now.getDay()];
        els.date.textContent = `${day} ${month} ${year}, ${dayName}`;
    }

    // --- Google Sheets Data Fetch ---
    function getCleanSheetId(sheetId) {
        // Formattan ID'yi çıkar
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
            try {
                const parsedData = JSON.parse(cachedData);
                retryCount = 0;
                processData(parsedData);
            } catch (e) {
                showError('Veri yüklenemedi ve önbellek bozuk. İnternet bağlantısı gerekiyor.\nDenenen URL: ' + (failedUrl || 'Bilinmiyor'));
            }
        } else {
            showError('İnternet bağlantısı yok ve daha önce kaydedilmiş veri bulunamadı.\nDenenen URL: ' + (failedUrl || 'Bilinmiyor'));
            if (els.slideDots) els.slideDots.innerHTML = '';
            if (els.slideCounter) els.slideCounter.innerHTML = '';
            if (els.tickerContent) els.tickerContent.textContent = 'Bağlantı Yok';
        }
    }

    // CORS Atlatmak için JSONP yöntemi (Dosya yolundan çalışan tarayıcılar için)
    function fetchData(sheetId) {
        const id = getCleanSheetId(sheetId);
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseGoogleSheetData&sheet=DUYURULAR`;
        const scriptId = 'jsonp-sheet-fetch';

        let oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        // JSONP Callback Fonksiyonu
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
                            let val = '';
                            if (row.c[index]) {
                                // Tarih formatı ise formattan(.f) al, yoksa direkt değeri(.v) al
                                val = row.c[index].f || row.c[index].v;
                                if (val === null || val === undefined) val = '';
                            }
                            rowObj[col.label] = val.toString().trim();
                        }
                    });
                    resultData.push(rowObj);
                });

                localStorage.setItem('cachedAnnouncements', JSON.stringify(resultData));
                processData(resultData);
            } catch (e) {
                console.error("JSONP parse hatası:", e);
                loadFromCache(url);
            }

            // Temizlik
            delete window.parseGoogleSheetData;
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        script.onerror = function () {
            retryCount++;
            if (retryCount <= CONFIG.MAX_RETRIES) {
                setTimeout(() => fetchData(sheetId), CONFIG.RETRY_DELAY);
            } else {
                loadFromCache(url);
            }
        };
        document.body.appendChild(script);
    }

    // --- Detect media type from URL ---
    function getMediaType(url) {
        if (!url) return null;
        const lower = url.toLowerCase();
        const videoExts = ['.mp4', '.webm', '.ogg', '.mov'];
        const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

        // YouTube
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
            return 'youtube';
        }
        // Direct video file
        for (const ext of videoExts) {
            if (lower.includes(ext)) return 'video';
        }
        // Direct image
        for (const ext of imgExts) {
            if (lower.includes(ext)) return 'image';
        }
        // Google Drive image
        if (lower.includes('drive.google.com') || lower.includes('googleusercontent.com')) {
            return 'image';
        }
        // Unsplash or common image hosts
        if (lower.includes('unsplash.com') || lower.includes('pexels.com') || lower.includes('imgur.com')) {
            return 'image';
        }
        // Default: try as image
        if (url.length > 0) return 'image';
        return null;
    }

    function getYouTubeId(url) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
        return match ? match[1] : null;
    }

    function processData(rows) {
        slides = [];
        tickerItems = [];

        rows.forEach(row => {
            const normalized = {};
            Object.keys(row).forEach(key => {
                const k = (key || '').trim().toLowerCase();
                normalized[k] = (row[key] || '').toString().trim();
            });

            const baslik = normalized['baslik'] || normalized['başlık'] || '';
            const icerik = normalized['icerik'] || normalized['içerik'] || '';
            const kategori = (normalized['kategori'] || '').toLowerCase();
            const tarih = normalized['tarih'] || '';
            const aktif = (normalized['aktif'] || 'evet').toLowerCase();
            const bant = (normalized['bant'] || 'hayir').toLowerCase();
            const gorsel = normalized['gorsel'] || normalized['görsel'] || normalized['resim'] || normalized['image'] || '';
            const video = normalized['video'] || '';

            if (aktif === 'hayır' || aktif === 'hayir' || aktif === 'h' || aktif === 'no') return;
            if (!baslik) return;

            const catInfo = CATEGORY_MAP[kategori] || DEFAULT_CATEGORY;

            // Decide media: video takes priority, then gorsel
            let mediaUrl = '';
            let mediaType = null;
            if (video) {
                mediaUrl = video;
                mediaType = getMediaType(video);
            } else if (gorsel) {
                mediaUrl = gorsel;
                mediaType = getMediaType(gorsel);
            }

            const item = {
                baslik,
                icerik,
                kategori,
                tarih,
                catInfo,
                mediaUrl,
                mediaType,
            };

            if (bant === 'evet' || bant === 'e' || bant === 'yes') {
                tickerItems.push(item);
            }

            slides.push(item);
        });

        // Remove loading slide
        if (els.loadingSlide) {
            els.loadingSlide.style.display = 'none';
        }

        if (slides.length === 0) {
            showError('DUYURULAR sekmesinde gösterilecek aktif bir duyuru (Başlık sütunu dolu olan) bulunamadı.');
            if (els.slideDots) els.slideDots.innerHTML = '';
            if (els.slideCounter) els.slideCounter.innerHTML = '';
            if (els.tickerContent) els.tickerContent.textContent = 'Duyuru Yok';
            return;
        }

        renderSlides();
        renderDots();
        updateSlideCounter();
        renderTicker();
        startSlideshow();
    }

    // --- Render Slides ---
    function buildMediaHtml(item) {
        if (!item.mediaUrl || !item.mediaType) return '';

        switch (item.mediaType) {
            case 'image':
                return `<div class="slide-media">
                    <img src="${escapeAttr(item.mediaUrl)}" alt="${escapeAttr(item.baslik)}" loading="lazy" onerror="this.closest('.slide-media').style.display='none'; this.closest('.slide-card').classList.add('no-media');">
                </div>`;

            case 'video':
                return `<div class="slide-media">
                    <video src="${escapeAttr(item.mediaUrl)}" autoplay loop muted playsinline onerror="this.closest('.slide-media').style.display='none'; this.closest('.slide-card').classList.add('no-media');"></video>
                </div>`;

            case 'youtube':
                const ytId = getYouTubeId(item.mediaUrl);
                if (!ytId) return '';
                return `<div class="slide-media">
                    <iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0&modestbranding=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:none;"></iframe>
                </div>`;

            default:
                return '';
        }
    }

    function renderSlides() {
        els.slidesContainer.innerHTML = '';

        slides.forEach((item, index) => {
            const slideEl = document.createElement('div');
            slideEl.className = `slide ${index === 0 ? 'active' : ''}`;
            slideEl.setAttribute('data-index', index);

            const hasMedia = item.mediaUrl && item.mediaType;
            const mediaHtml = buildMediaHtml(item);
            const noMediaClass = hasMedia ? '' : 'no-media';

            const dateHtml = item.tarih
                ? `<div class="slide-date"><span class="slide-date-icon">📅</span> ${formatDate(item.tarih)}</div>`
                : '';

            const iconHtml = hasMedia ? '' : `<div class="slide-icon">${item.catInfo.icon}</div>`;

            slideEl.innerHTML = `
                <div class="slide-card ${item.catInfo.class} ${noMediaClass}">
                    ${mediaHtml}
                    <div class="slide-text">
                        ${iconHtml}
                        <div class="slide-category ${item.catInfo.class}">${item.catInfo.label}</div>
                        <h2 class="slide-title">${escapeHtml(item.baslik)}</h2>
                        <p class="slide-content">${escapeHtml(item.icerik)}</p>
                        ${dateHtml}
                    </div>
                    <div class="slide-progress" id="progress-${index}"></div>
                </div>
            `;

            els.slidesContainer.appendChild(slideEl);
        });

        currentSlideIndex = 0;
    }

    function renderDots() {
        els.slideDots.innerHTML = '';
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `slide-dot ${index === 0 ? 'active' : ''}`;
            dot.setAttribute('data-index', index);
            els.slideDots.appendChild(dot);
        });
    }

    function updateSlideCounter() {
        if (els.slideCounter) {
            els.slideCounter.innerHTML = `<span class="current">${currentSlideIndex + 1}</span> / ${slides.length}`;
        }
    }

    // --- Ticker ---
    let tickerDisplayItems = [];
    let currentTickerIndex = 0;
    let tickerCycleTimer = null;

    function renderTicker() {
        if (tickerItems.length > 0) {
            tickerDisplayItems = tickerItems.map(s => ({
                icon: s.catInfo.icon,
                text: s.baslik + (s.icerik ? '  —  ' + s.icerik : '')
            }));
        } else {
            tickerDisplayItems = slides.map(s => ({
                icon: s.catInfo.icon,
                text: s.baslik
            }));
        }

        if (tickerDisplayItems.length === 0) {
            els.tickerContent.textContent = 'Henüz duyuru bulunmuyor';
            return;
        }

        if (tickerDisplayItems.length > 3) {
            renderScrollingTicker();
        } else {
            renderFadeTicker();
        }
    }

    function renderScrollingTicker() {
        els.tickerContent.className = 'ticker-content scroll-mode';

        const buildItems = () => tickerDisplayItems.map(item =>
            `<span class="ticker-item"><span class="ticker-item-icon">${item.icon}</span> ${escapeHtml(item.text)}</span>`
        ).join('<span class="ticker-separator">●</span>');

        els.tickerContent.innerHTML = buildItems() + '<span class="ticker-separator">●</span>' + buildItems();

        requestAnimationFrame(() => {
            const contentWidth = els.tickerContent.scrollWidth / 2;
            const duration = contentWidth / CONFIG.TICKER_SCROLL_SPEED;
            els.tickerContent.style.setProperty('--ticker-duration', `${duration}s`);
        });
    }

    function renderFadeTicker() {
        els.tickerContent.className = 'ticker-content fade-ticker';
        currentTickerIndex = 0;
        showTickerItem(currentTickerIndex);

        if (tickerCycleTimer) clearInterval(tickerCycleTimer);
        if (tickerDisplayItems.length > 1) {
            tickerCycleTimer = setInterval(() => {
                currentTickerIndex = (currentTickerIndex + 1) % tickerDisplayItems.length;
                els.tickerContent.style.opacity = '0';
                setTimeout(() => {
                    showTickerItem(currentTickerIndex);
                    els.tickerContent.style.opacity = '1';
                }, 350);
            }, CONFIG.TICKER_CYCLE);
        }
    }

    function showTickerItem(index) {
        const item = tickerDisplayItems[index];
        if (!item) return;
        const counter = tickerDisplayItems.length > 1
            ? `  (${index + 1}/${tickerDisplayItems.length})`
            : '';
        els.tickerContent.innerHTML = `<span class="ticker-item"><span class="ticker-item-icon">${item.icon}</span> ${escapeHtml(item.text)}${counter}</span>`;
    }

    // --- Slideshow Engine ---
    function startSlideshow() {
        if (slideTimer) clearInterval(slideTimer);
        if (progressTimer) clearInterval(progressTimer);

        if (slides.length <= 1) return;

        startProgress();
        scheduleNextPreview();

        slideTimer = setInterval(() => {
            nextSlide();
        }, CONFIG.SLIDE_INTERVAL);
    }

    function nextSlide() {
        const allSlides = els.slidesContainer.querySelectorAll('.slide');
        const allDots = els.slideDots.querySelectorAll('.slide-dot');

        // Pause video in current slide
        pauseSlideMedia(allSlides[currentSlideIndex]);

        allSlides[currentSlideIndex].classList.remove('active');
        allSlides[currentSlideIndex].classList.add('exit-left');
        if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.remove('active');

        const prevIndex = currentSlideIndex;
        setTimeout(() => {
            if (allSlides[prevIndex]) allSlides[prevIndex].classList.remove('exit-left');
        }, 900);

        currentSlideIndex = (currentSlideIndex + 1) % slides.length;

        allSlides[currentSlideIndex].classList.remove('exit-left');
        allSlides[currentSlideIndex].classList.add('active');
        if (allDots[currentSlideIndex]) allDots[currentSlideIndex].classList.add('active');

        // Play video in new slide
        playSlideMedia(allSlides[currentSlideIndex]);

        updateSlideCounter();
        resetProgress();
        startProgress();
        hideNextPreview();
        scheduleNextPreview();
    }

    function pauseSlideMedia(slideEl) {
        if (!slideEl) return;
        const video = slideEl.querySelector('video');
        if (video) {
            try { video.pause(); } catch (e) { /* ignore */ }
        }
    }

    function playSlideMedia(slideEl) {
        if (!slideEl) return;
        const video = slideEl.querySelector('video');
        if (video) {
            try { video.currentTime = 0; video.play(); } catch (e) { /* ignore */ }
        }
    }

    function startProgress() {
        const progressBar = document.getElementById(`progress-${currentSlideIndex}`);
        if (!progressBar) return;

        let elapsed = 0;
        progressBar.style.width = '0%';

        progressTimer = setInterval(() => {
            elapsed += CONFIG.PROGRESS_STEP;
            const pct = (elapsed / CONFIG.SLIDE_INTERVAL) * 100;
            progressBar.style.width = `${Math.min(pct, 100)}%`;
            progressBar.style.transitionDuration = `${CONFIG.PROGRESS_STEP}ms`;
        }, CONFIG.PROGRESS_STEP);
    }

    function resetProgress() {
        if (progressTimer) clearInterval(progressTimer);
        document.querySelectorAll('.slide-progress').forEach(bar => {
            bar.style.transition = 'none';
            bar.style.width = '0%';
            void bar.offsetWidth;
            bar.style.transition = '';
        });
    }

    // --- Next Slide Preview ---
    function scheduleNextPreview() {
        if (nextPreviewTimer) clearTimeout(nextPreviewTimer);
        if (slides.length <= 1) return;

        const showDelay = CONFIG.SLIDE_INTERVAL - CONFIG.NEXT_PREVIEW_SHOW;
        nextPreviewTimer = setTimeout(() => {
            showNextPreview();
        }, Math.max(showDelay, 2000));
    }

    function showNextPreview() {
        if (!els.nextPreview || slides.length <= 1) return;
        const nextIndex = (currentSlideIndex + 1) % slides.length;
        const nextItem = slides[nextIndex];
        if (!nextItem) return;

        if (els.nextPreviewTitle) {
            els.nextPreviewTitle.textContent = nextItem.baslik;
        }
        els.nextPreview.classList.add('visible');
    }

    function hideNextPreview() {
        if (els.nextPreview) {
            els.nextPreview.classList.remove('visible');
        }
    }

    // --- No Data / Error States ---
    function showNoData() {
        els.slidesContainer.innerHTML = `
            <div class="slide active">
                <div class="slide-card cat-default no-media no-data-card">
                    <div class="slide-text">
                        <div class="slide-icon">📭</div>
                        <h2 class="slide-title">Henüz Duyuru Yok</h2>
                        <p class="slide-content">Google Sheets tablosuna duyuru eklendiğinde burada görüntülenecektir.</p>
                    </div>
                </div>
            </div>
        `;
        els.slideDots.innerHTML = '';
        if (els.slideCounter) els.slideCounter.innerHTML = '';
        els.tickerContent.textContent = 'Henüz aktif duyuru bulunmuyor • Duyurular yakında burada!';
    }

    function showError(message) {
        els.slidesContainer.innerHTML = `
            <div class="slide active">
                <div class="slide-card cat-onemli no-media no-data-card">
                    <div class="slide-text">
                        <div class="slide-icon">⚠️</div>
                        <h2 class="slide-title">Bağlantı Hatası</h2>
                        <p class="slide-content">${escapeHtml(message)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Utilities ---
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split(/[-/.]/);
            let date;
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    date = new Date(parts[0], parts[1] - 1, parts[2]);
                } else {
                    date = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                date = new Date(dateStr);
            }
            if (isNaN(date.getTime())) return dateStr;

            const day = date.getDate();
            const month = TR_MONTHS[date.getMonth()];
            const year = date.getFullYear();
            const dayName = TR_DAYS[date.getDay()];
            return `${day} ${month} ${year}, ${dayName}`;
        } catch {
            return dateStr;
        }
    }

    // --- Weather ---
    const WEATHER_ICONS = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌦️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '❄️', 73: '❄️', 75: '❄️',
        80: '🌦️', 81: '🌧️', 82: '⛈️',
        95: '⛈️', 96: '⛈️', 99: '⛈️',
    };

    const WEATHER_DESC_TR = {
        0: 'Açık', 1: 'Az bulutlu', 2: 'Parçalı bulutlu', 3: 'Bulutlu',
        45: 'Sisli', 48: 'Kırağlı sis',
        51: 'Hafif çisenti', 53: 'Çisenti', 55: 'Yoğun çisenti',
        61: 'Hafif yağmur', 63: 'Yağmurlu', 65: 'Şiddetli yağmur',
        71: 'Hafif kar', 73: 'Karlı', 75: 'Yoğun kar',
        80: 'Sağanak', 81: 'Kuvvetli sağanak', 82: 'Şiddetli sağanak',
        95: 'Gök gürültülü fırtına', 96: 'Dolulu fırtına', 99: 'Şiddetli dolu',
    };

    function fetchFreeWeather() {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LAT}&longitude=${CONFIG.WEATHER_LON}&current_weather=true`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.current_weather) {
                    const cw = data.current_weather;
                    const code = cw.weathercode;
                    const temp = Math.round(cw.temperature);
                    const icon = WEATHER_ICONS[code] || '🌤️';
                    const desc = WEATHER_DESC_TR[code] || 'Belirsiz';

                    if (els.weatherTemp) els.weatherTemp.textContent = `${temp}°C`;
                    if (els.weatherIcon) els.weatherIcon.textContent = icon;
                    if (els.weatherDesc) els.weatherDesc.textContent = desc;
                    if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY;

                    localStorage.setItem('cachedWeatherTemp', `${temp}°C`);
                    localStorage.setItem('cachedWeatherIcon', icon);
                    localStorage.setItem('cachedWeatherDesc', desc);
                }
            })
            .catch(() => {
                const savedTemp = localStorage.getItem('cachedWeatherTemp');
                const savedIcon = localStorage.getItem('cachedWeatherIcon');
                const savedDesc = localStorage.getItem('cachedWeatherDesc');

                if (savedTemp && savedIcon) {
                    if (els.weatherTemp) els.weatherTemp.textContent = savedTemp;
                    if (els.weatherIcon) els.weatherIcon.textContent = savedIcon;
                    if (els.weatherDesc) els.weatherDesc.textContent = savedDesc || 'Belirsiz';
                    if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY;
                } else {
                    if (els.weatherTemp) els.weatherTemp.textContent = '—°C';
                    if (els.weatherIcon) els.weatherIcon.textContent = '⛅';
                    if (els.weatherDesc) els.weatherDesc.textContent = 'Bilgi alınamadı';
                    if (els.weatherCity) els.weatherCity.textContent = CONFIG.WEATHER_CITY;
                }
            });
    }

    function fetchWeather() {
        fetchFreeWeather();
    }

    // --- Start ---
    document.addEventListener('DOMContentLoaded', init);
})();
