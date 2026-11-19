// ── Default Fallback VFS Templates (hydrated live from /api/config) ──
let templatesByGender = {
  male: [
    {
      id: "3.png",
      fileName: "3.png",
      gender: "male",
      url: "/VFS/3.png?v=revised",
      title: "Deep Space Voyager",
      subtitle: "Cobalt-Blue Suit • Sapphire Ringed Planet",
      badge: "CHARACTER 01",
    },
    {
      id: "4.png",
      fileName: "4.png",
      gender: "male",
      url: "/VFS/4.png?v=revised",
      title: "Solar Flare Explorer",
      subtitle: "Crimson-Orange Suit • Ringed Red Giant",
      badge: "CHARACTER 02",
    },
  ],
  female: [
    {
      id: "1.png",
      fileName: "1.png",
      gender: "female",
      url: "/VFS/1.png?v=revised",
      title: "Aurora Cosmos Navigator",
      subtitle: "Emerald-Green Suit • Aurora Moonscape",
      badge: "CHARACTER 01",
    },
    {
      id: "2.png",
      fileName: "2.png",
      gender: "female",
      url: "/VFS/2.png?v=revised",
      title: "Nebula Galaxy Pioneer",
      subtitle: "Violet-Purple Suit • Spiral Cosmic Galaxy",
      badge: "CHARACTER 02",
    },
  ],
};

// ── State ──
const state = {
  step: "gender",
  gender: null,
  template: null,
  photo: null,
};

let cameraStream = null;
let countdownActive = false;
let countdownTimerId = null;

// ── DOM References ──
const panelGender = document.getElementById("panel-gender");
const panelCharacter = document.getElementById("panel-character");
const panelCamera = document.getElementById("panel-camera");
const panelResult = document.getElementById("panel-result");
const brandLogoHome = document.getElementById("brand-logo-home");
const stepPills = document.querySelectorAll(".step-pill[data-step-pill]");

const genderCards = document.querySelectorAll(".gender-card[data-select-gender]");
const genderPreviewMale = document.getElementById("gender-preview-male");
const genderPreviewFemale = document.getElementById("gender-preview-female");

const characterStepTag = document.getElementById("character-step-tag");
const characterGrid = document.getElementById("character-grid");
const btnBackToGender = document.getElementById("btn-back-to-gender");
const btnCharBack = document.getElementById("btn-char-back");
const btnCharContinue = document.getElementById("btn-char-continue");

const selectedTemplateThumb = document.getElementById("selected-template-thumb");
const selectedTemplateGender = document.getElementById("selected-template-gender");
const selectedTemplateTitle = document.getElementById("selected-template-title");
const btnChangeChar = document.getElementById("btn-change-char");
const btnCameraBack = document.getElementById("btn-camera-back");

const videoEl = document.getElementById("camera-video");
const canvasEl = document.getElementById("camera-canvas");
const previewEl = document.getElementById("camera-preview");
const countdownOverlay = document.getElementById("countdown-overlay");
const cameraErrorEl = document.getElementById("camera-error");

const btnCapture = document.getElementById("btn-capture");
const btnTimer = document.getElementById("btn-timer");
const fileUploadInput = document.getElementById("file-upload-input");
const btnRetake = document.getElementById("btn-retake");
const btnGenerate = document.getElementById("btn-generate");

const loadingView = document.getElementById("loading-view");
const loadingSub = document.getElementById("loading-sub");
const errorView = document.getElementById("error-view");
const errorMsgEl = document.getElementById("error-msg");
const resultView = document.getElementById("result-view");

const resultImage = document.getElementById("result-image");
const resultQrImage = document.getElementById("result-qr-image");
const btnPrint = document.getElementById("btn-print");
const btnDownload = document.getElementById("btn-download");

// ── Fullscreen Toggle ──
const fullscreenBtn = document.getElementById("btn-fullscreen");
if (fullscreenBtn) {
  const expandIcon = fullscreenBtn.querySelector(".expand-icon");
  const compressIcon = fullscreenBtn.querySelector(".compress-icon");

  fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      expandIcon.classList.add("hidden");
      compressIcon.classList.remove("hidden");
    } else {
      expandIcon.classList.remove("hidden");
      compressIcon.classList.add("hidden");
    }
  });
}

// ── Load Dynamic VFS Templates from Backend ──
async function loadTemplatesConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    if (data?.templates?.male?.length) {
      templatesByGender.male = data.templates.male;
      if (genderPreviewMale) genderPreviewMale.src = data.templates.male[0].url;
    }
    if (data?.templates?.female?.length) {
      templatesByGender.female = data.templates.female;
      if (genderPreviewFemale) genderPreviewFemale.src = data.templates.female[0].url;
    }
    if (state.step === "character" && state.gender) {
      renderCharacterGrid(state.gender);
    }
  } catch (err) {
    console.warn("Using built-in VFS template definitions:", err);
  }
}

// ── 4-Step Screen Navigation ──
const STEP_ORDER = ["gender", "character", "camera", "result"];

function showScreen(screen) {
  state.step = screen;

  if (screen !== "camera") {
    stopCamera();
  }

  panelGender.classList.toggle("hidden", screen !== "gender");
  panelCharacter.classList.toggle("hidden", screen !== "character");
  panelCamera.classList.toggle("hidden", screen !== "camera");
  panelResult.classList.toggle("hidden", screen !== "result");

  const activeIdx = STEP_ORDER.indexOf(screen);
  stepPills.forEach((pill) => {
    const pillStep = pill.dataset.stepPill;
    const idx = STEP_ORDER.indexOf(pillStep);
    pill.classList.toggle("active", idx === activeIdx);
    pill.classList.toggle("completed", idx !== -1 && idx < activeIdx);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Step 1: Gender Selection ──
function selectGender(gender) {
  const changedGender = state.gender !== gender;
  state.gender = gender;

  genderCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.selectGender === gender);
  });

  const list = templatesByGender[gender] || [];
  if (changedGender || !state.template || state.template.gender !== gender) {
    state.template = list[0] || null;
  }

  renderCharacterGrid(gender);
  showScreen("character");
}

genderCards.forEach((card) => {
  card.addEventListener("click", () => {
    selectGender(card.dataset.selectGender);
  });
});

// ── Step 2: Character Selection ──
function renderCharacterGrid(gender) {
  const list = templatesByGender[gender] || [];
  if (characterStepTag) {
    characterStepTag.textContent = `STEP 02 // ${gender.toUpperCase()} COSMIC SUITS`;
  }

  characterGrid.innerHTML = "";

  list.forEach((tpl) => {
    const isSelected = state.template && state.template.id === tpl.id;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `style-card${isSelected ? " selected" : ""}`;
    card.dataset.templateId = tpl.id;

    card.innerHTML = `
      <span class="selected-check" aria-hidden="true">&#x2713;</span>
      <img src="${tpl.url}" alt="${tpl.title}" />
    `;

    card.addEventListener("click", () => {
      state.template = tpl;
      characterGrid.querySelectorAll(".style-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.templateId === tpl.id);
      });
      btnCharContinue.disabled = false;
    });

    card.addEventListener("dblclick", () => {
      state.template = tpl;
      proceedToCamera();
    });

    characterGrid.appendChild(card);
  });

  btnCharContinue.disabled = !state.template;
}

function proceedToCamera() {
  if (!state.template) return;
  updateSelectedTemplateSummary();
  showScreen("camera");
  startCamera();
}

function updateSelectedTemplateSummary() {
  if (!state.template) return;
  if (selectedTemplateThumb) selectedTemplateThumb.src = state.template.url;
  if (selectedTemplateGender) {
    selectedTemplateGender.textContent = `${state.template.gender.toUpperCase()} CHARACTER`;
  }
  if (selectedTemplateTitle) selectedTemplateTitle.textContent = state.template.title;
}

btnBackToGender?.addEventListener("click", () => showScreen("gender"));
btnCharBack?.addEventListener("click", () => showScreen("gender"));
btnCharContinue?.addEventListener("click", proceedToCamera);

btnChangeChar?.addEventListener("click", () => {
  showScreen("character");
});

btnCameraBack?.addEventListener("click", () => {
  showScreen("character");
});

// ── Step 3: Camera Management ──
async function startCamera() {
  cameraErrorEl.classList.add("hidden");
  cameraErrorEl.textContent = "";

  if (state.photo) {
    showCapturedPreview(state.photo);
    return;
  }

  videoEl.classList.remove("hidden");
  previewEl.classList.add("hidden");
  btnCameraBack?.classList.remove("hidden");
  btnCapture.classList.remove("hidden");
  btnTimer.classList.remove("hidden");
  document.getElementById("btn-upload-label")?.classList.remove("hidden");
  btnRetake.classList.add("hidden");
  btnGenerate.classList.add("hidden");
  btnGenerate.disabled = true;

  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280, min: 640 },
        height: { ideal: 960, min: 480 },
      },
      audio: false,
    });
    videoEl.srcObject = cameraStream;
  } catch (err) {
    console.warn("Camera access error:", err);
    cameraErrorEl.textContent =
      "Camera unavailable or permission denied. You can also use 'UPLOAD PHOTO'.";
    cameraErrorEl.classList.remove("hidden");
  }
}

function stopCamera() {
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
    countdownActive = false;
    countdownOverlay?.classList.add("hidden");
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

function captureFromWebcam() {
  if (!videoEl.videoWidth) {
    cameraErrorEl.textContent =
      "Camera feed is not ready yet. Please wait a moment or upload a photo.";
    cameraErrorEl.classList.remove("hidden");
    return;
  }

  const vw = videoEl.videoWidth || 1280;
  const vh = videoEl.videoHeight || 960;

  canvasEl.width = vw;
  canvasEl.height = vh;
  const ctx = canvasEl.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Mirror horizontally to match live selfie preview
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, vw, vh);

  const dataUrl = canvasEl.toDataURL("image/png");
  state.photo = dataUrl;
  stopCamera();
  showCapturedPreview(dataUrl);
}

function showCapturedPreview(dataUrl) {
  previewEl.src = dataUrl;
  previewEl.classList.remove("hidden");
  videoEl.classList.add("hidden");
  btnCameraBack?.classList.add("hidden");
  btnCapture.classList.add("hidden");
  btnTimer.classList.add("hidden");
  document.getElementById("btn-upload-label")?.classList.add("hidden");
  btnRetake.classList.remove("hidden");
  btnGenerate.classList.remove("hidden");
  btnGenerate.disabled = false;
  cameraErrorEl.classList.add("hidden");
}

// 3-second countdown capture
btnTimer.addEventListener("click", () => {
  if (countdownActive) return;
  countdownActive = true;
  let count = 3;
  countdownOverlay.textContent = count;
  countdownOverlay.classList.remove("hidden");

  countdownTimerId = setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownOverlay.textContent = count;
    } else {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      countdownOverlay.classList.add("hidden");
      countdownActive = false;
      captureFromWebcam();
    }
  }, 1000);
});

// CLICK button captures photo
btnCapture.addEventListener("click", captureFromWebcam);

// Upload photo fallback
if (fileUploadInput) {
  fileUploadInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photo = reader.result;
      stopCamera();
      showCapturedPreview(state.photo);
    };
    reader.readAsDataURL(file);
    fileUploadInput.value = "";
  });
}

// RETAKE button recaptures photo
btnRetake.addEventListener("click", () => {
  state.photo = null;
  startCamera();
});

// Reset flow back to Step 1 (Gender Selection)
function resetToStart() {
  state.photo = null;
  state.gender = null;
  state.template = null;
  genderCards.forEach((c) => c.classList.remove("selected"));
  showScreen("gender");
}

if (brandLogoHome) {
  brandLogoHome.addEventListener("click", resetToStart);
}

// ── Step 4: Generate Selected VFS Cosmic Portrait & QR Code ──
async function generateCosmicPortrait() {
  if (!state.photo || !state.template) return;

  stopCamera();
  showScreen("result");

  if (loadingSub && state.template) {
    loadingSub.textContent = `Character: ${state.template.title} (${state.template.gender.toUpperCase()})`;
  }

  loadingView.classList.remove("hidden");
  errorView.classList.add("hidden");
  resultView.classList.add("hidden");

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo: state.photo,
        gender: state.gender || state.template.gender,
        templateId: state.template.id,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to generate your cosmic portrait.");
    }

    resultImage.src = data.image;

    // Populate QR code
    const qrTarget = data.publicUrl || data.image;
    if (data.qrCode) {
      resultQrImage.src = data.qrCode;
    } else {
      resultQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(qrTarget)}`;
    }

    loadingView.classList.add("hidden");
    resultView.classList.remove("hidden");
  } catch (err) {
    loadingView.classList.add("hidden");
    errorView.classList.remove("hidden");
    errorMsgEl.textContent = err.message || "Error generating cosmic portrait.";
  }
}

btnGenerate.addEventListener("click", generateCosmicPortrait);

// Error view actions
document.getElementById("btn-error-back").addEventListener("click", () => {
  showScreen("camera");
  startCamera();
});

document.getElementById("btn-error-retry").addEventListener("click", () => {
  generateCosmicPortrait();
});

// ── Print Full-Bleed 2:3 (4x6) Cosmic Portrait (Unlimited Repeat Prints) ──
function printCosmicPhoto() {
  const imgSrc = resultImage.src;
  if (!imgSrc) return;

  const existingFrame = document.getElementById("print-frame");
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const printWin = iframe.contentWindow;
  const doc = printWin.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>VFS Rendezvous 2026 Photo Print</title>
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img {
      width: 100vw;
      height: 100vh;
      object-fit: contain;
      display: block;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <img id="pimg" alt="VFS Cosmic Portrait Print" />
</body>
</html>`);
  doc.close();

  const pimg = doc.getElementById("pimg");
  let printed = false;

  const runPrint = () => {
    if (printed || !iframe.isConnected) return;
    printed = true;

    printWin.onafterprint = () => {
      window.focus();
    };

    setTimeout(() => {
      if (!iframe.isConnected) return;
      try {
        printWin.focus();
        printWin.print();
      } finally {
        window.focus();
      }
    }, 80);
  };

  const onReady = () => {
    if (typeof pimg.decode === "function") {
      pimg.decode().catch(() => {}).finally(runPrint);
    } else {
      runPrint();
    }
  };

  pimg.onload = onReady;
  pimg.onerror = runPrint;
  pimg.src = imgSrc;

  if (pimg.complete && pimg.naturalWidth > 0) {
    onReady();
  }
}

if (btnPrint) {
  btnPrint.addEventListener("click", printCosmicPhoto);
}

// Download Avatar button
if (btnDownload) {
  btnDownload.addEventListener("click", () => {
    const imgSrc = resultImage.src;
    if (!imgSrc) return;
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = `vfs_rendezvous2026_${Date.now()}.jpg`;
    a.click();
  });
}

// Start Over -> Reset back to Gender Selection page
document.getElementById("btn-start-over").addEventListener("click", resetToStart);

// Initialize on Step 1 (Gender Selection) and load live templates
loadTemplatesConfig();
showScreen("gender");

// Hot-reload style.css in real time without page refresh
(function enableLiveCssReload() {
  let lastTag = null;
  setInterval(async () => {
    try {
      const res = await fetch("style.css?t=" + Date.now(), { method: "HEAD", cache: "no-store" });
      const tag = res.headers.get("last-modified") || res.headers.get("content-length");
      if (lastTag && tag && tag !== lastTag) {
        const link = document.querySelector('link[rel="stylesheet"][href^="style.css"]');
        if (link) link.href = "style.css?v=" + Date.now();
      }
      if (tag) lastTag = tag;
    } catch (_) {}
  }, 1500);
})();
