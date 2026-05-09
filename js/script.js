const video = document.getElementById('bgVideo');
const muteBtn = document.getElementById('muteBtn');
const volume = document.getElementById('volume');
const bgOverlayEl = document.querySelector('.bg__overlay');
const openBgAppearanceBtn = document.getElementById('openBgAppearanceBtn');
const bgAppearanceModal = document.getElementById('bgAppearanceModal');
const closeBgAppearanceBtn = document.getElementById('closeBgAppearanceBtn');
const saveBgAppearanceBtn = document.getElementById('saveBgAppearanceBtn');
const resetBgAppearanceBtn = document.getElementById('resetBgAppearanceBtn');
const bgVideoSaturationInput = document.getElementById('bgVideoSaturation');
const bgVideoBrightnessInput = document.getElementById('bgVideoBrightness');
const bgVideoHueInput = document.getElementById('bgVideoHue');
const bgVideoBlurInput = document.getElementById('bgVideoBlur');
const bgSaturationValueEl = document.getElementById('bgSaturationValue');
const bgBrightnessValueEl = document.getElementById('bgBrightnessValue');
const bgHueValueEl = document.getElementById('bgHueValue');
const bgBlurValueEl = document.getElementById('bgBlurValue');

const heroTitleEl = document.getElementById('heroTitle');
const heroSubtitleEl = document.getElementById('heroSubtitle');
const bioBodyP1El = document.getElementById('bioBodyP1');
const bioBodyP2El = document.getElementById('bioBodyP2');
const bioEmailBtn = document.getElementById('bioEmailBtn');
const bioEmailDisplayEl = document.getElementById('bioEmailDisplay');
const heroAvatarEl = document.getElementById('heroAvatar');
const editorHeroTitle = document.getElementById('editorHeroTitle');
const editorHeroSubtitle = document.getElementById('editorHeroSubtitle');
const editorBioP1 = document.getElementById('editorBioP1');
const editorBioP2 = document.getElementById('editorBioP2');
const editorEmailVisible = document.getElementById('editorEmailVisible');
const editorEmailAddress = document.getElementById('editorEmailAddress');
const editorAvatarSrc = document.getElementById('editorAvatarSrc');
const editorAvatarAlt = document.getElementById('editorAvatarAlt');

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const ICON_MUTED = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
const ICON_UNMUTED = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

function setUiFromState() {
  const isMuted = video.muted || video.volume === 0;
  muteBtn.innerHTML = isMuted ? ICON_MUTED : ICON_UNMUTED;
  muteBtn.setAttribute('aria-pressed', String(!isMuted));
  muteBtn.classList.toggle('audio__btn--playing', !isMuted);

  const eqEl = document.getElementById('audioEq');
  if (eqEl) eqEl.classList.toggle('audio__eq--paused', isMuted);
}

function setVolumeFromSlider() {
  const v = clamp01(parseInt(volume.value, 10) / 100);
  video.volume = v;

  // If the slider is moved above 0, keep it unmuted (if user chose to unmute).
  if (v === 0) {
    video.muted = true;
  }

  setUiFromState();
}

// Defaults: autoplay-safe muted, but volume slider should read 30%.
video.muted = true;
video.volume = 0.3;
volume.value = '30';
setUiFromState();

// Some browsers require an explicit play() attempt.
video.play().catch(() => {
  // No-op; user interaction will allow playback.
});

muteBtn.addEventListener('click', async () => {
  // User gesture: ensure playback is started.
  try {
    await video.play();
  } catch {
    // ignore
  }

  const wantsUnmute = video.muted;
  if (wantsUnmute) {
    video.muted = false;
    // Ensure volume matches slider (defaults to 30%).
    setVolumeFromSlider();
  } else {
    video.muted = true;
  }

  setUiFromState();
});

volume.addEventListener('input', () => {
  // Changing the slider implies the user wants audible audio (unless 0).
  const v = clamp01(parseInt(volume.value, 10) / 100);
  video.volume = v;
  video.muted = v === 0 ? true : false;
  setUiFromState();
});

// Keep UI in sync if browser changes muted state.
video.addEventListener('volumechange', setUiFromState);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (bgAppearanceModal && !bgAppearanceModal.hidden) {
    persistAndCloseHomeModal();
  }
});

async function writeToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function setCopyButtonState(btn, label, ms) {
  const prev = btn.textContent;
  btn.textContent = label;
  btn.classList.add('is-copied');
  window.setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove('is-copied');
  }, ms);
}

// Toast notification system (mirrors the lookup site's showToast)
const toastEl = document.getElementById('toast');
const toastTextEl = document.getElementById('toastText');
let toastTimer = null;

function showToast(message) {
  if (!toastEl || !toastTextEl) return;

  toastTextEl.textContent = message;
  toastEl.hidden = false;
  toastEl.classList.remove('toast--hide');
  toastEl.classList.add('toast--show');

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('toast--show');
    toastEl.classList.add('toast--hide');

    window.setTimeout(() => {
      toastEl.hidden = true;
    }, 240);
  }, 1800);
}

document.addEventListener('click', async (e) => {
  const btn = e.target?.closest?.('button[data-copy]');
  if (!btn) return;

  const value = btn.getAttribute('data-copy') || '';
  const ok = await writeToClipboard(value);
  setCopyButtonState(btn, ok ? 'Copied' : 'Failed', 900);
  if (ok) showToast('Copied to clipboard.');
});

/* ----- Home editor: background video + hero / bio / email / avatar ----- */
const HOME_EDITOR_KEY = 'homeEditorSettings';
const LEGACY_BG_KEY = 'homeBgAppearance';
const BG_VIDEO_FILTER_TAIL = 'contrast(1.05)';

function defaultBackgroundSlice() {
  return { saturation: 105, brightness: 40, hue: 0, blur: 0 };
}

function canonicalHomeDefaults() {
  return {
    background: defaultBackgroundSlice(),
    hero: {
      title: 'Sena',
      subtitle: 'Jay · Sweden',
    },
    body: {
      paragraph1:
        "Hi there, my name is Jay. I'm from Sweden — I do security research and spend a lot of time in Linux.",
      paragraph2: 'Reach out using the email button.',
    },
    email: {
      visible: true,
      displayText: 'ladies@asia.com',
      copyText: 'ladies@asia.com',
    },
    avatar: {
      src: 'images/profile.webp',
      alt: 'Jay profile picture',
    },
  };
}

function buildVideoFilter(blurPx, hueDeg, saturationPct, brightnessPct) {
  const sat = Math.min(200, Math.max(0, saturationPct)) / 100;
  const bright = Math.min(150, Math.max(20, brightnessPct)) / 100;
  const hue = Math.min(360, Math.max(0, hueDeg));
  const blur = Math.min(24, Math.max(0, blurPx));
  const parts = [`saturate(${sat})`, BG_VIDEO_FILTER_TAIL, `brightness(${bright})`];
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  return parts.join(' ');
}

function clampBackgroundSlice(candidate) {
  const d = defaultBackgroundSlice();
  if (!candidate || typeof candidate !== 'object') return d;
  return {
    saturation:
      typeof candidate.saturation === 'number'
        ? Math.min(200, Math.max(0, candidate.saturation))
        : d.saturation,
    brightness:
      typeof candidate.brightness === 'number'
        ? Math.min(150, Math.max(20, candidate.brightness))
        : d.brightness,
    hue:
      typeof candidate.hue === 'number'
        ? Math.min(360, Math.max(0, candidate.hue))
        : d.hue,
    blur:
      typeof candidate.blur === 'number'
        ? Math.min(24, Math.max(0, candidate.blur))
        : d.blur,
  };
}

function pickResolvedString(primary, fallback) {
  const a = typeof primary === 'string' ? primary.trim() : '';
  if (a.length) return a;
  const b = typeof fallback === 'string' ? fallback.trim() : '';
  return b;
}

function captureHomeDomSnapshot() {
  const defaults = canonicalHomeDefaults();
  return {
    hero: {
      title: pickResolvedString(heroTitleEl?.textContent ?? '', defaults.hero.title),
      subtitle: pickResolvedString(
        heroSubtitleEl?.textContent ?? '',
        defaults.hero.subtitle
      ),
    },
    body: {
      paragraph1: pickResolvedString(bioBodyP1El?.textContent ?? '', ''),
      paragraph2: pickResolvedString(bioBodyP2El?.textContent ?? '', ''),
    },
    email: {
      visible:
        !!(bioEmailBtn != null &&
          !(bioEmailBtn.hidden || bioEmailBtn.hasAttribute('hidden'))),
      displayText: pickResolvedString(
        bioEmailDisplayEl?.textContent ?? '',
        defaults.email.displayText
      ),
      copyText: pickResolvedString(
        bioEmailBtn?.getAttribute('data-copy') ?? '',
        defaults.email.copyText
      ),
    },
    avatar: {
      src: pickResolvedString(heroAvatarEl?.getAttribute('src') ?? '', defaults.avatar.src),
      alt: pickResolvedString(heroAvatarEl?.getAttribute('alt') ?? '', defaults.avatar.alt),
    },
  };
}

function normalizeFullHomeSettings(saved, domSnapshot) {
  const base = canonicalHomeDefaults();
  const dom = domSnapshot || captureHomeDomSnapshot();
  const patch = saved && typeof saved === 'object' ? saved : null;

  const merged = {
    background: clampBackgroundSlice({
      ...base.background,
      ...(patch?.background || {}),
    }),
    hero: {
      title: pickResolvedString(
        patch?.hero?.title ?? '',
        dom.hero.title ?? base.hero.title
      ).slice(0, 280),
      subtitle: pickResolvedString(
        patch?.hero?.subtitle ?? '',
        dom.hero.subtitle ?? base.hero.subtitle
      ).slice(0, 160),
    },
    body: {
      paragraph1: pickResolvedString(
        patch?.body?.paragraph1 ?? '',
        dom.body.paragraph1
      ).slice(0, 2000),
      paragraph2: pickResolvedString(
        patch?.body?.paragraph2 ?? '',
        dom.body.paragraph2
      ).slice(0, 2000),
    },
    email: {
      visible:
        typeof patch?.email?.visible === 'boolean'
          ? patch.email.visible
          : dom.email.visible,
      displayText: pickResolvedString(
        patch?.email?.displayText ?? '',
        dom.email.displayText
      ).slice(0, 120),
      copyText: pickResolvedString(patch?.email?.copyText ?? '', dom.email.copyText).slice(
        0,
        120
      ),
    },
    avatar: {
      src: pickResolvedString(patch?.avatar?.src ?? '', dom.avatar.src).slice(0, 500),
      alt: pickResolvedString(patch?.avatar?.alt ?? '', dom.avatar.alt).slice(0, 200),
    },
  };

  if (!merged.email.copyText) merged.email.copyText = base.email.copyText;
  if (!merged.email.displayText) merged.email.displayText = merged.email.copyText;
  if (!merged.avatar.src) merged.avatar.src = base.avatar.src;

  return merged;
}

function loadHomeEditorSettings() {
  const dom = captureHomeDomSnapshot();
  try {
    const raw = localStorage.getItem(HOME_EDITOR_KEY);
    if (raw) {
      return normalizeFullHomeSettings(JSON.parse(raw), dom);
    }
  } catch {
    // fall through
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_BG_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return normalizeFullHomeSettings(
        { background: clampBackgroundSlice(legacy) },
        dom
      );
    }
  } catch {
    // fall through
  }

  return normalizeFullHomeSettings(null, dom);
}

function saveHomeEditorSettings(settings) {
  localStorage.setItem(HOME_EDITOR_KEY, JSON.stringify(settings));
  try {
    localStorage.removeItem(LEGACY_BG_KEY);
  } catch {
    // ignore
  }
}

function applyBackgroundSlice(state) {
  if (!video) return;
  if (bgOverlayEl) bgOverlayEl.removeAttribute('style');
  document.body.style.background = '';
  video.style.filter = buildVideoFilter(
    state.blur,
    state.hue,
    state.saturation,
    state.brightness
  );
}

function applyHeroAndBioSlice(settings) {
  const { hero, body, email, avatar } = settings;
  if (heroTitleEl) heroTitleEl.textContent = hero.title;
  if (heroSubtitleEl) heroSubtitleEl.textContent = hero.subtitle;
  if (bioBodyP1El) bioBodyP1El.textContent = body.paragraph1;
  if (bioBodyP2El) bioBodyP2El.textContent = body.paragraph2;

  if (bioEmailDisplayEl && bioEmailBtn) {
    bioEmailDisplayEl.textContent = email.displayText;
    bioEmailBtn.setAttribute('data-copy', email.copyText);
    bioEmailBtn.setAttribute('aria-label', `Copy ${email.copyText}`);
    if (email.visible) {
      bioEmailBtn.hidden = false;
      bioEmailBtn.removeAttribute('hidden');
    } else {
      bioEmailBtn.hidden = true;
      bioEmailBtn.setAttribute('hidden', 'true');
    }
  }

  if (heroAvatarEl) {
    heroAvatarEl.src = avatar.src;
    heroAvatarEl.alt = avatar.alt || 'Profile photo';
  }
}

function applyHomeSettings(settings) {
  applyBackgroundSlice(settings.background);
  applyHeroAndBioSlice(settings);
}

function syncSliderLabels(state) {
  if (!bgVideoSaturationInput) return;
  if (bgSaturationValueEl) bgSaturationValueEl.textContent = String(state.background.saturation);
  if (bgBrightnessValueEl)
    bgBrightnessValueEl.textContent = String(state.background.brightness);
  if (bgHueValueEl) bgHueValueEl.textContent = String(state.background.hue);
  if (bgBlurValueEl) bgBlurValueEl.textContent = String(state.background.blur);
}

function syncHomeEditorForm(state) {
  if (!editorHeroTitle) return;
  const { background, hero, body, email, avatar } = state;

  bgVideoSaturationInput.value = String(background.saturation);
  bgVideoBrightnessInput.value = String(background.brightness);
  bgVideoHueInput.value = String(background.hue);
  bgVideoBlurInput.value = String(background.blur);
  syncSliderLabels(state);

  editorHeroTitle.value = hero.title;
  editorHeroSubtitle.value = hero.subtitle;
  editorBioP1.value = body.paragraph1;
  editorBioP2.value = body.paragraph2;

  editorEmailVisible.checked = email.visible !== false;
  if (editorEmailAddress) {
    editorEmailAddress.value =
      pickResolvedString(email.copyText, email.displayText) ||
      canonicalHomeDefaults().email.copyText;
  }

  editorAvatarSrc.value = avatar.src;
  editorAvatarAlt.value = avatar.alt;
}

function readHomeEditorFromFormInputs() {
  const defaults = canonicalHomeDefaults();

  const saturation = Math.min(
    200,
    Math.max(0, parseInt(bgVideoSaturationInput?.value ?? '105', 10))
  );
  const brightness = Math.min(
    150,
    Math.max(20, parseInt(bgVideoBrightnessInput?.value ?? '80', 10))
  );
  const hue = Math.min(
    360,
    Math.max(0, parseInt(bgVideoHueInput?.value ?? '0', 10))
  );
  const blur = Math.min(
    24,
    Math.max(0, parseInt(bgVideoBlurInput?.value ?? '0', 10))
  );

  let mail =
    editorEmailAddress?.value?.trim() ||
    pickResolvedString(defaults.email.copyText, defaults.email.displayText);
  if (!mail) mail = defaults.email.copyText;

  let avatarSrc = editorAvatarSrc?.value?.trim() || defaults.avatar.src;
  let avatarAlt = editorAvatarAlt?.value?.trim() || defaults.avatar.alt;

  const settings = normalizeFullHomeSettings(
    {
      background: clampBackgroundSlice({ saturation, brightness, hue, blur }),
      hero: {
        title: editorHeroTitle?.value ?? '',
        subtitle: editorHeroSubtitle?.value ?? '',
      },
      body: {
        paragraph1: editorBioP1?.value ?? '',
        paragraph2: editorBioP2?.value ?? '',
      },
      email: {
        visible: !!editorEmailVisible?.checked,
        displayText: mail,
        copyText: mail,
      },
      avatar: { src: avatarSrc, alt: avatarAlt },
    },
    captureHomeDomSnapshot()
  );

  return settings;
}

function persistAndCloseHomeModal() {
  const next = readHomeEditorFromFormInputs();
  appliedHomeSnapshot = next;
  applyHomeSettings(next);
  saveHomeEditorSettings(next);
  bgAppearanceModal.hidden = true;
}

function openHomeEditorModal() {
  if (!bgAppearanceModal) return;
  syncHomeEditorForm(appliedHomeSnapshot);
  bgAppearanceModal.hidden = false;
}

/** Live snapshot kept in sync whenever the modal edits change the page preview */
let appliedHomeSnapshot = canonicalHomeDefaults();

function initHomePageEditorBundle() {
  if (
    !video ||
    !openBgAppearanceBtn ||
    !bgAppearanceModal ||
    !bgVideoSaturationInput ||
    !bgVideoBrightnessInput ||
    !bgVideoHueInput ||
    !bgVideoBlurInput ||
    !editorHeroTitle
  ) {
    return;
  }

  appliedHomeSnapshot = loadHomeEditorSettings();
  applyHomeSettings(appliedHomeSnapshot);

  openBgAppearanceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openHomeEditorModal();
  });

  const previewEverything = () => {
    appliedHomeSnapshot = readHomeEditorFromFormInputs();
    applyHomeSettings(appliedHomeSnapshot);
    syncSliderLabels(appliedHomeSnapshot);
  };

  closeBgAppearanceBtn?.addEventListener('click', () => persistAndCloseHomeModal());
  saveBgAppearanceBtn?.addEventListener('click', () => persistAndCloseHomeModal());

  bgAppearanceModal.addEventListener('click', (e) => {
    if (e.target === bgAppearanceModal) persistAndCloseHomeModal();
  });

  resetBgAppearanceBtn?.addEventListener('click', () => {
    appliedHomeSnapshot = JSON.parse(JSON.stringify(canonicalHomeDefaults()));
    syncHomeEditorForm(appliedHomeSnapshot);
    applyHomeSettings(appliedHomeSnapshot);
    saveHomeEditorSettings(appliedHomeSnapshot);
  });

  [
    bgVideoSaturationInput,
    bgVideoBrightnessInput,
    bgVideoHueInput,
    bgVideoBlurInput,
    editorHeroTitle,
    editorHeroSubtitle,
    editorBioP1,
    editorBioP2,
    editorEmailVisible,
    editorEmailAddress,
    editorAvatarSrc,
    editorAvatarAlt,
  ].forEach((el) => el?.addEventListener('input', previewEverything));

  editorEmailVisible?.addEventListener('change', previewEverything);
}

initHomePageEditorBundle();

/* ========================================================
   INNOVATIONS — Particles, Cursor Glow, Scramble Text, EQ
   ======================================================== */

/* --- 1. Particle System (3D rotating sphere with cursor repulsion) --- */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  let mouseX = -9999, mouseY = -9999;
  const PARTICLE_COUNT = 400;
  let SPHERE_RADIUS = Math.max(w, h) * 0.7;
  const REPEL_RADIUS = 320;
  const REPEL_STRENGTH = 80;
  const ROTATION_SPEED = 0.00018;
  const particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    SPHERE_RADIUS = Math.max(w, h) * 0.7;
  }
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  document.addEventListener('mouseleave', () => {
    mouseX = -9999;
    mouseY = -9999;
  });

  // Distribute points on sphere using golden spiral (Fibonacci)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    particles.push({
      bx: Math.sin(phi) * Math.cos(theta),
      by: Math.sin(phi) * Math.sin(theta),
      bz: Math.cos(phi),
      sx: 0, sy: 0,
      dx: 0, dy: 0,
      size: Math.random() * 1.5 + 0.6,
      // Per-particle random drift for organic, less regular motion
      driftSpeed: (Math.random() * 0.6 + 0.4),
      driftPhase: Math.random() * Math.PI * 2,
    });
  }

  let angleY = 0;
  let angleX = 0.3; // slight tilt

  function animate() {
    ctx.clearRect(0, 0, w, h);
    angleY += ROTATION_SPEED;
    angleX += ROTATION_SPEED * 0.3;

    const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
    const cx = w / 2;
    const cy = h / 2;
    const time = Date.now() * 0.001;

    const projected = [];

    for (const p of particles) {
      // Per-particle organic wobble
      const wobble = Math.sin(time * p.driftSpeed + p.driftPhase) * 0.015;
      const wobbleY = Math.cos(time * p.driftSpeed * 0.7 + p.driftPhase) * 0.012;

      // Rotate around Y axis (with wobble)
      const rx = (p.bx + wobble) * cosY - p.bz * sinY;
      const rz = (p.bx + wobble) * sinY + p.bz * cosY;
      let y = p.by + wobbleY;

      // Rotate around X axis (tilt)
      const y2 = y * cosX - rz * sinX;
      const z2 = y * sinX + rz * cosX;
      y = y2;
      const z = z2;

      const sx = cx + rx * SPHERE_RADIUS;
      const sy = cy + y * SPHERE_RADIUS;

      const depth = (z + 1) / 2;

      // Cursor repulsion — affects ALL particles, force falls off with distance
      const rdx = sx - mouseX;
      const rdy = sy - mouseY;
      const rDist = Math.sqrt(rdx * rdx + rdy * rdy);

      let targetDx = 0, targetDy = 0;
      if (rDist > 0) {
        const force = REPEL_STRENGTH * 0.6;
        targetDx = (rdx / rDist) * force;
        targetDy = (rdy / rDist) * force;
      }

      p.dx += (targetDx - p.dx) * 0.08;
      p.dy += (targetDy - p.dy) * 0.08;

      p.sx = sx + p.dx;
      p.sy = sy + p.dy;

      projected.push({ p, depth, z });
    }

    // Sort far to near
    projected.sort((a, b) => a.z - b.z);

    for (const { p, depth } of projected) {
      const alpha = 0.04 + depth * 0.32;
      const size = p.size * (0.4 + depth * 0.8);

      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 225, 255, ${alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }
  animate();
})();

/* --- 3. Scramble Text Effect --- */
(function initScrambleText() {
  const el = document.getElementById('heroTitle');
  if (!el) return;

  // Read saved settings first
  const HOME_KEY = 'homeEditorSettings';
  let targetText = 'Sena';
  try {
    const raw = localStorage.getItem(HOME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.hero?.title) targetText = parsed.hero.title;
    }
  } catch { /* use default */ }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const iterations = 4;
  let frame = 0;

  // Start with placeholder text
  el.textContent = targetText.replace(/[^ ]/g, () => chars[Math.floor(Math.random() * chars.length)]);

  function scramble() {
    el.textContent = targetText
      .split('')
      .map((char, i) => {
        if (char === ' ') return ' ';
        if (i < frame) return targetText[i];
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    frame += 1 / iterations;

    if (frame < targetText.length) {
      requestAnimationFrame(scramble);
    } else {
      el.textContent = targetText;
    }
  }

  // Start the effect after a small delay for the reveal animation
  setTimeout(scramble, 200);
})();

/* --- 4. Audio Equalizer Animation --- */
(function initEqualizer() {
  const eqEl = document.getElementById('audioEq');
  if (!eqEl) return;
  const bars = eqEl.querySelectorAll('.audio__eqBar');
  if (!bars.length) return;

  function animateBars() {
    if (!eqEl.classList.contains('audio__eq--paused')) {
      bars.forEach((bar) => {
        const h = Math.random() * 14 + 3;
        bar.style.height = h + 'px';
      });
    }
    setTimeout(animateBars, 140);
  }
  animateBars();
})();
