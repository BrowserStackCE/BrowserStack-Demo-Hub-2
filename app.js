// Demo Hub — hash-based router & views
const app = document.getElementById("app");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Accepts a bare ID, a full watch URL, a youtu.be link, or a playlist URL.
// Returns { videoId, playlistId } — either may be null.
function parseYouTube(input) {
  if (!input) return { videoId: null, playlistId: null };
  const raw = String(input).trim();
  // Bare 11-char video id (no slashes / query)
  if (/^[\w-]{11}$/.test(raw)) return { videoId: raw, playlistId: null };
  let videoId = null,
    playlistId = null;
  try {
    const u = new URL(raw);
    videoId = u.searchParams.get("v");
    playlistId = u.searchParams.get("list");
    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1).split("/")[0] || null;
    }
    if (!videoId && u.pathname.includes("/embed/")) {
      videoId = u.pathname.split("/embed/")[1].split("/")[0] || null;
    }
  } catch (e) {
    // Not a URL — fall through with nulls
  }
  return { videoId: videoId || null, playlistId: playlistId || null };
}

// Build a privacy-friendly embed URL that supports single videos AND (unlisted) playlists.
// Pass { jsapi: true } to enable the IFrame API (needed for auto-advance).
function embedUrl(video, opts = {}) {
  const parsed = parseYouTube(video.youtubeId);
  const playlistId = video.playlistId || parsed.playlistId;
  const base = { rel: "0", modestbranding: "1", playsinline: "1" };
  if (opts.jsapi) {
    base.enablejsapi = "1";
    base.origin = location.origin;
  }
  if (opts.autoplay) {
    base.autoplay = "1";
  }
  const params = new URLSearchParams(base);
  let path;
  if (parsed.videoId) {
    path = parsed.videoId;
    // Do NOT add list= here — it causes YouTube to handle playlist navigation internally,
    // which prevents the ENDED event from firing for our auto-advance logic.
    // We manage playlist navigation ourselves via setupAutoAdvance.
  } else if (playlistId && !parsed.videoId) {
    // Playlist-only (no specific video): use the playlist embed endpoint.
    return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}&list=${encodeURIComponent(playlistId)}`;
  } else {
    path = "";
  }
  return `https://www.youtube-nocookie.com/embed/${path}?${params.toString()}`;
}

// Auto-advance: load YT IFrame API once, attach player after iframe loads.
let _ytReady = false;
let _ytReadyCbs = [];
function onYouTubeIframeAPIReady() {
  _ytReady = true;
  _ytReadyCbs.forEach(fn => fn());
  _ytReadyCbs = [];
}
function whenYTReady(fn) {
  if (_ytReady) { fn(); return; }
  _ytReadyCbs.push(fn);
  if (!document.querySelector('script[src*="iframe_api"]')) {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}

let _currentPlayer = null;
let _autoplayNext = false; // set true when auto-advancing so next video autoplays

function setupAutoAdvance(nextHash, shouldAutoplay) {
  // Destroy previous player instance cleanly.
  if (_currentPlayer) {
    try { _currentPlayer.destroy(); } catch(e) {}
    _currentPlayer = null;
  }

  whenYTReady(() => {
    const iframe = document.getElementById("yt-player");
    if (!iframe) return; // user navigated away
    _currentPlayer = new YT.Player(iframe, {
      events: {
        onReady: (e) => {
          // If this render was triggered by auto-advance, start playing immediately.
          if (shouldAutoplay) {
            try { e.target.playVideo(); } catch(err) {}
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED && nextHash) {
            if (location.hash === nextHash) {
              render(true); // pass autoplay flag
            } else {
              _autoplayNext = true;
              location.hash = nextHash;
            }
          }
        }
      }
    });
  });
}

function thumbUrl(video) {
  const { videoId } = parseYouTube(video.youtubeId);
  return videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : "https://img.youtube.com/vi/videoseries/hqdefault.jpg";
}

function render(forceAutoplay) {
  const hash = location.hash.slice(1); // e.g. /product/crm/video/crm-1
  const parts = hash.split("/").filter(Boolean);
  const isHome = parts.length === 0 || parts[0] !== "product";
  document.querySelector(".navbar").classList.toggle("is-home", isHome);
  if (parts[0] === "product" && parts[2] === "video") {
    renderVideo(parts[1], parts[3], forceAutoplay || _autoplayNext);
  } else if (parts[0] === "product") {
    renderDashboard(parts[1]);
  } else {
    renderHome();
  }
  window.scrollTo(0, 0);
}

function renderHome() {
  const cards = PRODUCTS.map(
    (p) => `
    <div class="glass card" onclick="location.hash='#/product/${p.id}'">
      <div class="icon">${p.iconSvg ? `<img src="${p.iconSvg}" alt="${esc(p.name)}" style="width:32px;height:32px;object-fit:contain;" />` : p.icon}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.tagline)}</p>
      ${p.videos && p.videos.length > 0 ? `<div class="count">${p.videos.length} video${p.videos.length === 1 ? "" : "s"} &rarr;</div>` : ""}
    </div>`
  ).join("");
  
  app.innerHTML = `
    <div class="home-hero-wrap fade">
      <div class="hero-orb orb-1"></div>
      <div class="hero-orb orb-2"></div>
      <div class="hero-orb orb-3"></div>
      <div class="hero-glass">
        <div class="hero-logo-row">
          <img src="icons/browserstack-icon.svg" alt="BrowserStack" class="hero-logo" />
          <span class="hero-brand">BrowserStack</span>
        </div>
        <h1 class="hero-title">Welcome to the <span class="hero-grad">Demo Hub</span></h1>
        <p class="hero-sub">Explore, Learn, Launch</p>
        <p class="hero-desc">Explore interactive demos of BrowserStack's powerful testing features, all in one place. Whether you're new or looking to deepen your product knowledge, this hub helps you quickly understand, experience, and onboard with BrowserStack.</p>
        <div class="hero-chips">
          <span class="chip">🚀 Onboarding</span>
          <span class="chip">🎬 Video Walkthroughs</span>
          <span class="chip">📚 Documentation</span>
        </div>
      </div>
    </div>
    <h2 class="section-label fade">Choose a product</h2>
    <div class="grid fade">${cards}</div>
    <footer class="site-footer fade">
      <div class="footer-inner">
        <div class="footer-brand">
          <img src="icons/browserstack-icon.svg" alt="BrowserStack" width="28" height="28" />
          <span>BrowserStack Demo Hub</span>
        </div>
        <p class="footer-desc">Your one-stop destination for BrowserStack product walkthroughs, onboarding videos, and documentation.</p>
        <div class="footer-links">
          <a href="https://www.browserstack.com/docs" target="_blank" rel="noopener">Documentation</a>
          <a href="https://www.browserstack.com/contact" target="_blank" rel="noopener">Support</a>
          <a href="https://www.browserstack.com/blog" target="_blank" rel="noopener">Blog</a>
          <a href="https://www.browserstack.com/pricing" target="_blank" rel="noopener">Pricing</a>
        </div>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} BrowserStack. All rights reserved.</p>
      </div>
    </footer>`;
}

function renderDashboard(pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p) return renderHome();
  const cards = p.videos.map(
    (v) => `
    <div class="glass card vthumb" onclick="location.hash='#/product/${p.id}/video/${v.id}'">
      <div class="thumbwrap">
        <img class="thumbimg" src="${thumbUrl(v)}" alt="${esc(v.title)}" onerror="this.classList.add('noimg')" />
        <div class="play"><span>&#9654;</span></div>
        ${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ""}
      </div>
      <div class="meta">
        <h3>${esc(v.title)}</h3>
        <p>${esc(v.description).slice(0, 90)}${v.description.length > 90 ? "…" : ""}</p>
      </div>
    </div>`
  ).join("");
  app.innerHTML = `
    <div class="crumbs fade"><a onclick="location.hash='#/'">BrowserStack Demo Hub</a><span>›</span><span>${esc(p.name)}</span></div>
    <header class="hero fade" style="text-align:left;margin-bottom:32px;">
      <h1 style="font-size:2.4rem;display:flex;align-items:center;gap:12px;">
        ${p.iconSvg ? `<img src="${p.iconSvg}" alt="" style="width:36px;height:36px;object-fit:contain;flex-shrink:0;" />` : `<span>${p.icon}</span>`}
        ${esc(p.name)}
      </h1>
      <h5>${esc(p.tagline)}</h5>
    </header>
    <div class="grid fade">${cards}</div>`;
}

function renderVideo(pid, vid, autoplay) {
  const p = PRODUCTS.find((x) => x.id === pid);
  const idx = p ? p.videos.findIndex((x) => x.id === vid) : -1;
  const v = idx >= 0 ? p.videos[idx] : null;
  if (!v) return renderHome();
  // Accepts both plain URL strings and { label, url } objects.
  function renderLink(item, emoji) {
    const url = typeof item === "string" ? item : item.url;
    const label = typeof item === "string"
      ? decodeURIComponent(url.split("/").filter(Boolean).pop().replace(/-/g, " "))
      : item.label;
    return `<li><a href="${esc(url)}" target="_blank" rel="noopener">${emoji} ${esc(label)}</a></li>`;
  }
  const docs = v.docs.map((d) => renderLink(d, "📄")).join("");
  const links = v.links.map((l) => renderLink(l, "🔗")).join("");
  const playlist = p.videos
    .map(
      (item, i) => `
      <li class="pl-item ${item.id === v.id ? "active" : ""}" data-vid="${item.id}" onclick="location.hash='#/product/${p.id}/video/${item.id}'">
        <span class="pl-index">${i + 1}</span>
        <img class="pl-thumb" src="${thumbUrl(item)}" alt="" onerror="this.classList.add('noimg')" />
        <span class="pl-meta">
          <span class="pl-title">${esc(item.title)}</span>
          <span class="pl-sub">
            ${item.duration ? `<span class="pl-dur">${esc(item.duration)}</span>` : ""}
            ${item.id === v.id ? '<span class="pl-now">Now playing</span>' : ""}
          </span>
        </span>
      </li>`
    )
    .join("");
  app.innerHTML = `
    <div class="crumbs fade">
      <a onclick="location.hash='#/'">BrowserStack Demo Hub</a><span>›</span>
      <a onclick="location.hash='#/product/${p.id}'">${esc(p.name)}</a><span>›</span>
      <span>${esc(v.title)}</span>
    </div>
    <div class="detail fade">
      <div class="glass player-wrap">
        <iframe id="yt-player" src="${embedUrl(v, { jsapi: true, autoplay: _autoplayNext })}" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <div class="glass panel desc-panel">
        <h2>${esc(v.title)}</h2>
        <p>${esc(v.description)}</p>
      </div>
      <div class="side">
        <div class="glass panel pl-panel">
          <h4>▶ Playlist &middot; ${p.videos.length} videos</h4>
          <ul class="playlist">${playlist}</ul>
        </div>
        <div class="glass panel">
          <h4>Documentation</h4>
          <ul class="linklist">${docs || "<li><p>None yet.</p></li>"}</ul>
        </div>
        <div class="glass panel">
          <h4>Relevant Links</h4>
          <ul class="linklist">${links || "<li><p>None yet.</p></li>"}</ul>
        </div>
      </div>
    </div>`;
  // Consume the autoplay flag (reset after use so manual navigation doesn't autoplay).
  _autoplayNext = false;
  // Auto-advance to the next video when this one ends; pass autoplay flag to start playing.
  const next = p.videos[idx + 1];
  setupAutoAdvance(next ? `#/product/${p.id}/video/${next.id}` : null, !!autoplay);
  // Keep the active playlist item in view.
  const active = document.querySelector(".pl-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

// Dark mode toggle — persists in localStorage
function initDarkMode() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
  updateToggleIcon();
}
function updateToggleIcon() {
  const btn = document.getElementById("darkToggle");
  if (!btn) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.querySelector(".toggle-icon").textContent = isDark ? "☀️" : "🌙";
  btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
}
document.getElementById("darkToggle").addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  }
  updateToggleIcon();
});
initDarkMode();

window.addEventListener("hashchange", render);
render();