/* آيات — صفحة المصحف: اختيار السورة والقارئ وتشغيل التلاوة */
(function () {
  'use strict';

  const API = 'https://api.alquran.cloud/v1';
  const DEFAULT_RECITER = 'ar.alafasy';

  const surahSelect = document.getElementById('surahSelect');
  const reciterSelect = document.getElementById('reciterSelect');
  const playSurahBtn = document.getElementById('playSurahBtn');
  const continuousToggle = document.getElementById('continuousToggle');
  const surahHeader = document.getElementById('surahHeader');
  const surahName = document.getElementById('surahName');
  const surahInfo = document.getElementById('surahInfo');
  const surahBismillah = document.getElementById('surahBismillah');
  const readerStatus = document.getElementById('readerStatus');
  const versesList = document.getElementById('versesList');

  const playerBar = document.getElementById('playerBar');
  const npTitle = document.getElementById('npTitle');
  const npSub = document.getElementById('npSub');
  const audio = document.getElementById('audio');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const closePlayer = document.getElementById('closePlayer');
  const seek = document.getElementById('seek');
  const tCur = document.getElementById('tCur');
  const tDur = document.getElementById('tDur');

  let surahs = [];        // قائمة السور
  let reciters = [];      // قائمة القراء
  let ayahs = [];         // آيات السورة الحالية
  let currentSurah = null;
  let playingIndex = -1;  // رقم الآية قيد التشغيل داخل ayahs
  const audioCache = new Map(); // surah:ayah:reciter -> url

  function toArabicDigits(n) {
    return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  }

  function stripDiacritics(s) {
    return s.replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ٱ/g, 'ا');
  }

  // إزالة البسملة من أول آية (الواجهة تضيفها في رأس كل سورة ما عدا الفاتحة والتوبة)
  function stripBasmala(text) {
    const words = text.trim().split(/\s+/);
    if (words.length > 4) {
      const head = stripDiacritics(words.slice(0, 4).join(' '));
      if (head === 'بسم الله الرحمن الرحيم') {
        return words.slice(4).join(' ');
      }
    }
    return text;
  }

  async function apiGet(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error(json.status || 'API error');
    return json.data;
  }

  function setStatus(msg, isError) {
    if (!msg) {
      readerStatus.hidden = true;
      return;
    }
    readerStatus.hidden = false;
    readerStatus.textContent = msg;
    readerStatus.classList.toggle('error', !!isError);
  }

  /* ----- تحميل القوائم ----- */

  async function loadSurahs() {
    surahs = await apiGet('/surah');
    surahSelect.innerHTML = '';
    surahs.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.number;
      opt.textContent = toArabicDigits(s.number) + '. ' + s.name;
      surahSelect.appendChild(opt);
    });
    surahSelect.disabled = false;
  }

  async function loadReciters() {
    const editions = await apiGet('/edition?format=audio&language=ar&type=versebyverse');
    // حذف النسخ المكررة (ar.xxx-2) والإبقاء على الأصلية
    reciters = editions.filter((e) => !/-\d$/.test(e.identifier));
    reciterSelect.innerHTML = '';
    reciters.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.identifier;
      opt.textContent = r.name;
      reciterSelect.appendChild(opt);
    });
    reciterSelect.value = DEFAULT_RECITER;
    reciterSelect.disabled = false;
  }

  /* ----- تحميل سورة ----- */

  function renderSkeletons() {
    versesList.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton';
      sk.innerHTML = '<div class="sk-line"></div><div class="sk-line"></div>';
      versesList.appendChild(sk);
    }
  }

  function renderVerses() {
    versesList.innerHTML = '';
    ayahs.forEach((a, idx) => {
      const card = document.createElement('div');
      card.className = 'verse-card';
      card.id = 'verse-' + a.numberInSurah;

      const num = document.createElement('div');
      num.className = 'verse-num';
      num.textContent = toArabicDigits(a.numberInSurah);

      const body = document.createElement('div');
      body.className = 'verse-body';

      const text = document.createElement('div');
      text.className = 'verse-text quran-text';
      let t = a.text;
      if (currentSurah.number !== 1 && currentSurah.number !== 9 && a.numberInSurah === 1) {
        t = stripBasmala(t);
      }
      text.textContent = t;

      const foot = document.createElement('div');
      foot.className = 'verse-foot';

      const juz = document.createElement('span');
      juz.className = 'verse-juz';
      juz.textContent = 'الجزء ' + toArabicDigits(a.juz) + ' · صفحة ' + toArabicDigits(a.page);

      const playBtn = document.createElement('button');
      playBtn.className = 'verse-play';
      playBtn.textContent = '▶ استماع';
      playBtn.addEventListener('click', () => {
        if (playingIndex === idx && !audio.paused) {
          pausePlayback();
        } else {
          playVerse(idx);
        }
      });

      foot.appendChild(juz);
      foot.appendChild(playBtn);
      body.appendChild(text);
      body.appendChild(foot);
      card.appendChild(num);
      card.appendChild(body);
      versesList.appendChild(card);
    });
  }

  async function loadSurah(num) {
    stopPlayback();
    currentSurah = surahs.find((s) => s.number === Number(num));
    surahHeader.hidden = true;
    setStatus('جارٍ تحميل ' + currentSurah.name + '…');
    renderSkeletons();
    playSurahBtn.disabled = true;
    try {
      const data = await apiGet('/surah/' + num + '/quran-uthmani');
      ayahs = data.ayahs;
      surahName.textContent = data.name;
      const rev = data.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
      surahInfo.textContent = rev + ' · ' + toArabicDigits(data.numberOfAyahs) + ' آية';
      surahBismillah.hidden = data.number === 1 || data.number === 9;
      surahHeader.hidden = false;
      setStatus('');
      renderVerses();
      playSurahBtn.disabled = false;
    } catch (err) {
      setStatus('تعذر تحميل السورة. تحقق من الاتصال ثم أعد المحاولة.', true);
      versesList.innerHTML = '';
    }
  }

  /* ----- التشغيل ----- */

  async function resolveAudioUrl(idx) {
    const reciter = reciterSelect.value;
    const a = ayahs[idx];
    const key = currentSurah.number + ':' + a.numberInSurah + ':' + reciter;
    if (audioCache.has(key)) return audioCache.get(key);
    const d = await apiGet('/ayah/' + key.split(':').slice(0, 2).join(':') + '/' + reciter);
    const url = d.audio || (d.audioSecondary && d.audioSecondary[0]);
    if (!url) throw new Error('no audio');
    audioCache.set(key, url);
    return url;
  }

  function markPlayingCard(idx) {
    document.querySelectorAll('.verse-card.playing').forEach((c) => c.classList.remove('playing'));
    if (idx >= 0) {
      const card = document.getElementById('verse-' + ayahs[idx].numberInSurah);
      if (card) {
        card.classList.add('playing');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  async function playVerse(idx) {
    if (!ayahs.length || idx < 0 || idx >= ayahs.length) return;
    playingIndex = idx;
    const a = ayahs[idx];
    const reciterName = reciterSelect.options[reciterSelect.selectedIndex].textContent;
    npTitle.textContent = currentSurah.name + ' — الآية ' + toArabicDigits(a.numberInSurah);
    npSub.textContent = 'القارئ: ' + reciterName;
    playerBar.hidden = false;
    playPauseBtn.textContent = '…';
    markPlayingCard(idx);
    try {
      const url = await resolveAudioUrl(idx);
      if (playingIndex !== idx) return; // تغيرت الآية أثناء الجلب
      audio.src = url;
      await audio.play();
      playPauseBtn.textContent = '⏸';
    } catch (err) {
      playPauseBtn.textContent = '▶';
      npSub.textContent = 'تعذر تشغيل الصوت. أعد المحاولة.';
    }
  }

  function pausePlayback() {
    audio.pause();
    playPauseBtn.textContent = '▶';
  }

  function stopPlayback() {
    audio.pause();
    audio.removeAttribute('src');
    playingIndex = -1;
    markPlayingCard(-1);
  }

  audio.addEventListener('ended', () => {
    if (continuousToggle.checked && playingIndex >= 0 && playingIndex + 1 < ayahs.length) {
      playVerse(playingIndex + 1);
    } else {
      playPauseBtn.textContent = '▶';
      markPlayingCard(-1);
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      seek.value = (audio.currentTime / audio.duration) * 100;
      tCur.textContent = fmtTime(audio.currentTime);
      tDur.textContent = fmtTime(audio.duration);
    }
  });

  seek.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  });

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) {
      if (audio.src) {
        audio.play();
        playPauseBtn.textContent = '⏸';
      } else if (playingIndex >= 0) {
        playVerse(playingIndex);
      }
    } else {
      pausePlayback();
    }
  });

  prevBtn.addEventListener('click', () => { if (playingIndex > 0) playVerse(playingIndex - 1); });
  nextBtn.addEventListener('click', () => { if (playingIndex + 1 < ayahs.length) playVerse(playingIndex + 1); });
  closePlayer.addEventListener('click', () => { stopPlayback(); playerBar.hidden = true; });

  playSurahBtn.addEventListener('click', () => {
    if (ayahs.length) {
      continuousToggle.checked = true;
      playVerse(0);
    }
  });

  surahSelect.addEventListener('change', () => loadSurah(surahSelect.value));
  reciterSelect.addEventListener('change', () => {
    stopPlayback();
    playerBar.hidden = true;
  });

  /* ----- انطلاق ----- */

  (async function init() {
    try {
      await Promise.all([loadSurahs(), loadReciters()]);
      const params = new URLSearchParams(location.search);
      const requested = Number(params.get('surah')) || 1;
      surahSelect.value = String(requested);
      await loadSurah(requested);
    } catch (err) {
      setStatus('تعذر الاتصال بخدمة القرآن. تحقق من الإنترنت ثم حدّث الصفحة.', true);
    }
  })();
})();
