(function () {
    'use strict';

    const CONFIG = {
        SLIDE_INTERVAL: 10000, DATA_REFRESH: 120000, 
        CLOCK_REFRESH: 1000, TICKER_SCROLL_SPEED: 70,
        SIDEBAR_REFRESH: 60000, WEATHER_REFRESH: 600000
    };

    let slides = []; let tickerItems = []; let sidebarData = { dersler: [], ogretmenler: [], ogrenciler: [] };
    let currentSlideIndex = 0; let currentAlbumIndex = 0;
    let currentSlideTimeout = null; let progressTimer = null;
    const els = {};

    function cacheDom() {
        els.mainDisplay = document.getElementById('main-display'); els.schoolName = document.getElementById('school-name');
        els.schoolLogo = document.getElementById('school-logo'); els.time = document.getElementById('time');
        els.date = document.getElementById('date'); els.slidesContainer = document.getElementById('slides-container');
        els.slideDots = document.getElementById('slide-dots'); els.slideCounter = document.getElementById('slide-counter');
        els.tickerContent = document.getElementById('ticker-content'); els.weatherTemp = document.getElementById('weather-temp');
        els.weatherCity = document.getElementById('weather-city'); els.lessonStatus = document.getElementById('lesson-status');
        els.lessonTimer = document.getElementById('lesson-countdown'); els.lessonProgress = document.getElementById('lesson-progress');
    }

    // --- YAN PANEL MANTIĞI ---
    function fetchSidebarData() {
        const sheetId = localStorage.getItem('kiosk_sheet_id');
        if (!sheetId || !navigator.onLine) return;
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:sidebarCallback&sheet=YAN_PANEL&headers=0&t=${Date.now()}`;
        
        window.sidebarCallback = function(json) {
            try {
                if(json.table.rows.length > 0 && json.table.rows[0].c[0]) {
                    const data = JSON.parse(json.table.rows[0].c[0].v);
                    sidebarData.dersler = parseTimeBlocks(data.dersler);
                    renderDutyList('duty-teachers', parseDutyString(data.ogretmenler));
                    renderDutyList('duty-students', parseDutyString(data.ogrenciler));
                }
            } catch(e) { console.error("Yan panel verisi ayrıştırılamadı."); }
            delete window.sidebarCallback;
        };
        const script = document.createElement('script'); script.src = url; document.body.appendChild(script);
    }

    function parseTimeBlocks(str) {
        if(!str) return [];
        return str.split(',').map(s => {
            let p = s.trim().split('-');
            return p.length === 2 ? { start: p[0].trim(), end: p[1].trim() } : null;
        }).filter(Boolean);
    }

    function parseDutyString(str) {
        if(!str) return [];
        return str.split(',').map(s => {
            let p = s.trim().split(':');
            return p.length >= 2 ? { loc: p[0].trim(), name: p[1].trim() } : { loc: '', name: s.trim() };
        });
    }

    function renderDutyList(id, items) {
        const container = document.getElementById(id); if(!container) return;
        container.innerHTML = items.length ? items.map(i => `
            <div class="duty-item">
                <span>${i.name}</span>
                ${i.loc ? `<span class="duty-loc">${i.loc}</span>` : ''}
            </div>`).join('') : '<div class="duty-item">Kayıt bulunamadı.</div>';
    }

    function updateLessonTimer() {
        if(!sidebarData.dersler.length) return;
        const now = new Date(); const nowMins = (now.getHours() * 60) + now.getMinutes(); const nowSecs = now.getSeconds();
        let status = "DERS DIŞI", timeStr = "--:--", progress = 0;

        for(let i=0; i < sidebarData.dersler.length; i++) {
            let b = sidebarData.dersler[i];
            let start = getMins(b.start), end = getMins(b.end);
            
            if(nowMins >= start && nowMins < end) {
                let remMins = end - nowMins - 1, remSecs = 60 - nowSecs;
                status = `${i+1}. BLOK DERS`;
                timeStr = `${String(remMins).padStart(2,'0')}:${String(remSecs).padStart(2,'0')}`;
                progress = (((nowMins-start)*60 + nowSecs) / ((end-start)*60)) * 100;
                break;
            } else if(i < sidebarData.dersler.length - 1) {
                let nextStart = getMins(sidebarData.dersler[i+1].start);
                if(nowMins >= end && nowMins < nextStart) {
                    let remMins = nextStart - nowMins - 1, remSecs = 60 - nowSecs;
                    status = "TENEFFÜS";
                    timeStr = `${String(remMins).padStart(2,'0')}:${String(remSecs).padStart(2,'0')}`;
                    progress = (((nowMins-end)*60 + nowSecs) / ((nextStart-end)*60)) * 100;
                    break;
                }
            }
        }
        els.lessonStatus.textContent = status; els.lessonTimer.textContent = timeStr;
        els.lessonProgress.style.width = `${progress}%`;
    }

    function getMins(t) { let p = t.split(':').map(Number); return (p[0]*60) + p[1]; }

    // --- MEVCUT SLAYT MANTIĞI ---
    function fetchData() {
        const id = localStorage.getItem('kiosk_sheet_id'); if(!id || !navigator.onLine) return;
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:parseData&sheet=DUYURULAR&headers=1`;
        window.parseData = function(json) {
            const rows = json.table.rows.map(r => {
                let obj = {}; json.table.cols.forEach((c, i) => { if(c.label) obj[c.label.toLowerCase()] = r.c[i] ? (r.c[i].f || r.c[i].v) : ''; });
                return obj;
            });
            processSlides(rows); delete window.parseData;
        };
        const script = document.createElement('script'); script.src = url; document.body.appendChild(script);
    }

    function processSlides(rows) {
        slides = rows.filter(r => (r.aktif || 'evet').toLowerCase() === 'evet').map(r => ({
            baslik: r.baslik || r.başlık, icerik: r.icerik || r.içerik,
            kategori: (r.kategori || 'duyuru').toLowerCase(),
            album: (r.gorsel || '').split(',').concat((r.video || '').split(',')).filter(Boolean).map(u => ({ url: u.trim(), type: u.includes('mp4') ? 'video' : 'image' }))
        }));
        renderSlides(); startSlideshow();
    }

    function renderSlides() {
        els.slidesContainer.innerHTML = slides.map((s, i) => `
            <div class="slide ${i===0?'active':''}">
                <div class="slide-card">
                    <div class="slide-media">${s.album.length ? `<img src="${s.album[0].url}">` : ''}</div>
                    <div class="slide-text">
                        <h2 class="slide-title">${s.baslik}</h2>
                        <p class="slide-content">${s.icerik}</p>
                    </div>
                </div>
            </div>`).join('');
        els.slideCounter.innerHTML = `<span class="current">1</span> / ${slides.length}`;
        renderTicker();
    }

    function renderTicker() {
        let content = slides.map(s => `<span> ● ${s.baslik}</span>`).join('');
        els.tickerContent.innerHTML = content + content;
    }

    function startSlideshow() {
        if(currentSlideTimeout) clearTimeout(currentSlideTimeout);
        currentSlideTimeout = setTimeout(nextSlide, CONFIG.SLIDE_INTERVAL);
    }

    function nextSlide() {
        const all = document.querySelectorAll('.slide'); if(!all.length) return;
        all[currentSlideIndex].classList.remove('active');
        currentSlideIndex = (currentSlideIndex + 1) % slides.length;
        all[currentSlideIndex].classList.add('active');
        els.slideCounter.querySelector('.current').textContent = currentSlideIndex + 1;
        startSlideshow();
    }

    function updateClock() {
        const now = new Date();
        els.time.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        els.date.textContent = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    }

    function init() {
        cacheDom(); updateClock(); setInterval(updateClock, 1000);
        const sid = localStorage.getItem('kiosk_sheet_id');
        if(sid) { fetchData(); fetchSidebarData(); setInterval(fetchData, CONFIG.DATA_REFRESH); setInterval(fetchSidebarData, CONFIG.SIDEBAR_REFRESH); setInterval(updateLessonTimer, 1000); }
        else { document.getElementById('setup-prompt').classList.remove('hidden'); }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
