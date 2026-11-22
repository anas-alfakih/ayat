/* آيات — صفحة الهبوط: آية عشوائية مع تلاوتها */
(function () {
  'use strict';

  const API = 'https://api.alquran.cloud/v1';
  const TOTAL_AYAHS = 6236;

  const vodLoading = document.getElementById('vodLoading');
  const vodText = document.getElementById('vodText');
  const vodMeta = document.getElementById('vodMeta');
  const vodActions = document.getElementById('vodActions');
  const vodPlay = document.getElementById('vodPlay');
  const vodAnother = document.getElementById('vodAnother');
  const vodAudio = document.getElementById('vodAudio');

  let current = null; // { text, surahName, numberInSurah, audio }

  function toArabicDigits(n) {
    return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  }

  async function loadRandomVerse() {
    vodLoading.hidden = false;
    vodLoading.textContent = 'جارٍ اختيار آية لك…';
    vodText.hidden = true;
    vodMeta.hidden = true;
    vodActions.hidden = true;
    vodAudio.pause();
    vodPlay.textContent = '▶ استمع للآية';

    const ref = 1 + Math.floor(Math.random() * TOTAL_AYAHS);
    try {
      const res = await fetch(`${API}/ayah/${ref}/ar.alafasy`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const d = json.data;
      current = {
        text: d.text,
        surahName: d.surah.name,
        numberInSurah: d.numberInSurah,
        audio: d.audio || (d.audioSecondary && d.audioSecondary[0]) || null,
      };
      vodText.textContent = '﴿ ' + current.text + ' ﴾';
      vodMeta.textContent = current.surahName + ' — الآية ' + toArabicDigits(current.numberInSurah);
      vodLoading.hidden = true;
      vodText.hidden = false;
      vodMeta.hidden = false;
      vodActions.hidden = false;
    } catch (err) {
      vodLoading.textContent = 'تعذر تحميل الآية. تحقق من الاتصال ثم أعد المحاولة.';
    }
  }

  vodPlay.addEventListener('click', function () {
    if (!current || !current.audio) return;
    if (vodAudio.paused) {
      if (vodAudio.src !== current.audio) vodAudio.src = current.audio;
      vodAudio.play();
      vodPlay.textContent = '⏸ إيقاف مؤقت';
    } else {
      vodAudio.pause();
      vodPlay.textContent = '▶ استمع للآية';
    }
  });

  vodAudio.addEventListener('ended', function () {
    vodPlay.textContent = '▶ استمع للآية';
  });

  vodAnother.addEventListener('click', loadRandomVerse);

  loadRandomVerse();
})();
