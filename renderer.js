const tabsBar = document.getElementById("tabsBar");
const viewerArea = document.getElementById("viewerArea");
const addressBar = document.getElementById("addressBar");
const bookmarkList = document.getElementById("bookmarkList");
const historyListBox = document.getElementById("historyList");
const topInfo = document.getElementById("topInfo");
const clock = document.getElementById("clock");
const searchEngine = document.getElementById("searchEngine");
const tagline = document.getElementById("tagline");

const isIncognito = new URLSearchParams(window.location.search).get("incognito") === "1";

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let zoomLevels = {};

function saveData(key, value) {
  if (isIncognito) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function loadData(key, fallback) {
  if (isIncognito) return fallback;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

if (isIncognito) {
  tagline.textContent = "Incognito window - local history and bookmarks are not saved";
}

function setInfo(text) {
  topInfo.textContent = text;
}

function normalizeInput(value) {
  const input = value.trim();
  if (!input) return "";

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  if (input.includes(".") && !input.includes(" ")) {
    return "https://" + input;
  }

  return buildSearchUrl(input);
}

function buildSearchUrl(query) {
  const engine = searchEngine.value;

  if (engine === "bing") {
    return "https://www.bing.com/search?q=" + encodeURIComponent(query);
  }

  if (engine === "duckduckgo") {
    return "https://duckduckgo.com/?q=" + encodeURIComponent(query);
  }

  return "https://www.google.com/search?q=" + encodeURIComponent(query);
}

function getTabById(id) {
  return tabs.find(tab => tab.id === id);
}

function getDomainTitle(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "New Tab";
  }
}

function createHome(tabId) {
  const home = document.createElement("div");
  home.className = "home active";
  home.dataset.tabId = tabId;

  home.innerHTML = `
    <div class="home-center">
      <div class="home-logo">S Browser</div>
      <div class="home-text">Search, browse, save bookmarks, view history and use tabs</div>

      <div class="home-search">
        <input id="homeSearch-${tabId}" type="text" placeholder="Search anything..." />
        <button onclick="searchFromHome('${tabId}')">Search</button>
      </div>

      <div class="home-grid">
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://www.google.com')">
          <h3>Google</h3>
          <p>Search the web instantly.</p>
        </div>
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://www.youtube.com')">
          <h3>YouTube</h3>
          <p>Open videos and channels.</p>
        </div>
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://github.com')">
          <h3>GitHub</h3>
          <p>Explore repositories and source code.</p>
        </div>
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://www.wikipedia.org')">
          <h3>Wikipedia</h3>
          <p>Open articles and learning content.</p>
        </div>
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://developer.mozilla.org')">
          <h3>MDN Docs</h3>
          <p>Read web documentation.</p>
        </div>
        <div class="home-card" onclick="openUrlInTab('${tabId}', 'https://stackoverflow.com')">
          <h3>Stack Overflow</h3>
          <p>Find coding answers quickly.</p>
        </div>
      </div>
    </div>
  `;

  return home;
}

function createWebview(tabId) {
  const webview = document.createElement("webview");
  webview.className = "browser-view";
  webview.dataset.tabId = tabId;
  webview.setAttribute("allowpopups", "true");
  webview.setAttribute("partition", isIncognito ? `temp:${tabId}` : "persist:s_browser");

  webview.addEventListener("did-start-loading", () => {
    if (activeTabId === tabId) {
      setInfo("Loading...");
    }
  });

  webview.addEventListener("did-stop-loading", () => {
    const tab = getTabById(tabId);
    if (!tab) return;

    const currentUrl = webview.getURL() || tab.url;
    const currentTitle = webview.getTitle() || getDomainTitle(currentUrl);

    tab.url = currentUrl;
    tab.title = currentTitle;

    if (activeTabId === tabId) {
      addressBar.value = currentUrl;
      setInfo("Loaded: " + currentUrl);
    }

    addHistory(currentUrl);
    renderTabs();
    renderHistory();
  });

  webview.addEventListener("page-title-updated", (event) => {
    const tab = getTabById(tabId);
    if (!tab) return;
    tab.title = event.title || tab.title;
    renderTabs();
  });

  webview.addEventListener("did-fail-load", () => {
    if (activeTabId === tabId) {
      setInfo("This page could not load here. Try Open Outside.");
    }
  });

  webview.addEventListener("new-window", (event) => {
    if (event.url) {
      window.electronAPI.openExternal(event.url);
    }
  });

  return webview;
}

function ensureWebview(tabId) {
  let webview = document.querySelector(`.browser-view[data-tab-id="${tabId}"]`);
  if (!webview) {
    webview = createWebview(tabId);
    viewerArea.appendChild(webview);
  }
  return webview;
}

function newTab(url = "") {
  const id = "tab-" + (++tabCounter);

  tabs.push({
    id,
    title: "New Tab",
    url: ""
  });

  zoomLevels[id] = 1;

  const home = createHome(id);
  viewerArea.appendChild(home);

  switchTab(id);

  if (url) {
    openUrlInTab(id, url);
  } else {
    renderTabs();
  }
}

function switchTab(id) {
  activeTabId = id;

  document.querySelectorAll(".browser-view").forEach(view => {
    view.classList.toggle("active", view.dataset.tabId === id);
  });

  document.querySelectorAll(".home").forEach(home => {
    const tab = getTabById(id);
    home.classList.toggle("active", home.dataset.tabId === id && !tab.url);
  });

  const active = getTabById(id);
  if (!active) return;

  addressBar.value = active.url || "";
  setInfo(active.url ? "Ready: " + active.url : "Home");
  renderTabs();
}

function closeTab(id) {
  if (tabs.length === 1) return;

  tabs = tabs.filter(tab => tab.id !== id);
  delete zoomLevels[id];

  document.querySelectorAll(`[data-tab-id="${id}"]`).forEach(el => el.remove());

  if (activeTabId === id) {
    activeTabId = tabs[tabs.length - 1].id;
  }

  switchTab(activeTabId);
  renderTabs();
}

function closeCurrentTab() {
  if (!activeTabId) return;
  closeTab(activeTabId);
}

function renderTabs() {
  tabsBar.innerHTML = "";

  tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.id === activeTabId ? " active" : "");
    el.onclick = () => switchTab(tab.id);

    el.innerHTML = `
      <div class="tab-title">${tab.title || "New Tab"}</div>
      <button class="tab-close" onclick="event.stopPropagation(); closeTab('${tab.id}')">×</button>
    `;

    tabsBar.appendChild(el);
  });
}

function openUrlInTab(tabId, rawUrl) {
  const url = normalizeInput(rawUrl);
  if (!url) return;

  const tab = getTabById(tabId);
  if (!tab) return;

  const webview = ensureWebview(tabId);
  webview.src = url;

  tab.url = url;
  tab.title = getDomainTitle(url);

  const home = document.querySelector(`.home[data-tab-id="${tabId}"]`);
  if (home) home.classList.remove("active");

  switchTab(tabId);
  applyZoom(tabId);
  renderTabs();
}

function getActiveWebview() {
  return document.querySelector(`.browser-view[data-tab-id="${activeTabId}"]`);
}

function goToAddress() {
  if (!activeTabId) return;
  openUrlInTab(activeTabId, addressBar.value);
}

function searchWeb() {
  if (!activeTabId) return;
  const query = addressBar.value.trim();
  if (!query) return;
  openUrlInTab(activeTabId, buildSearchUrl(query));
}

function searchFromHome(tabId) {
  const input = document.getElementById(`homeSearch-${tabId}`);
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  openUrlInTab(tabId, buildSearchUrl(query));
}

function goBack() {
  const webview = getActiveWebview();
  if (webview && webview.canGoBack()) {
    webview.goBack();
  }
}

function goForward() {
  const webview = getActiveWebview();
  if (webview && webview.canGoForward()) {
    webview.goForward();
  }
}

function reloadTab() {
  const webview = getActiveWebview();
  if (webview) {
    webview.reload();
  }
}

function goHome() {
  const tab = getTabById(activeTabId);
  if (!tab) return;

  tab.url = "";
  tab.title = "New Tab";

  const webview = getActiveWebview();
  if (webview) webview.classList.remove("active");

  const home = document.querySelector(`.home[data-tab-id="${activeTabId}"]`);
  if (home) home.classList.add("active");

  addressBar.value = "";
  setInfo("Home");
  renderTabs();
}

function openOutside() {
  const tab = getTabById(activeTabId);
  if (!tab || !tab.url) return;
  window.electronAPI.openExternal(tab.url);
}

function downloadCurrent() {
  const tab = getTabById(activeTabId);
  if (!tab || !tab.url) return;
  window.electronAPI.downloadURL(tab.url);
  setInfo("Download started: " + tab.url);
}

function openQuick(url) {
  if (!activeTabId) return;
  openUrlInTab(activeTabId, url);
}

function addHistory(url) {
  if (!url || url.startsWith("about:") || isIncognito) return;

  let history = loadData("s_browser_history", []);
  if (history[0] !== url) history.unshift(url);
  history = history.slice(0, 40);
  saveData("s_browser_history", history);
}

function renderHistory() {
  const history = loadData("s_browser_history", []);
  historyListBox.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("button");
    empty.className = "list-item";
    empty.textContent = "No history yet";
    historyListBox.appendChild(empty);
    return;
  }

  history.forEach(url => {
    const item = document.createElement("button");
    item.className = "list-item";
    item.textContent = url;
    item.onclick = () => openUrlInTab(activeTabId, url);
    historyListBox.appendChild(item);
  });
}

function clearHistory() {
  if (isIncognito) return;
  localStorage.removeItem("s_browser_history");
  renderHistory();
  setInfo("History cleared");
}

function addBookmark() {
  if (isIncognito) {
    setInfo("Bookmarks are disabled in incognito");
    return;
  }

  const tab = getTabById(activeTabId);
  if (!tab || !tab.url) return;

  let bookmarks = loadData("s_browser_bookmarks", []);
  if (!bookmarks.includes(tab.url)) {
    bookmarks.unshift(tab.url);
    bookmarks = bookmarks.slice(0, 40);
    saveData("s_browser_bookmarks", bookmarks);
  }

  renderBookmarks();
  setInfo("Bookmarked: " + tab.url);
}

function removeBookmark(url) {
  let bookmarks = loadData("s_browser_bookmarks", []);
  bookmarks = bookmarks.filter(item => item !== url);
  saveData("s_browser_bookmarks", bookmarks);
  renderBookmarks();
}

function renderBookmarks() {
  bookmarkList.innerHTML = "";

  const addBtn = document.createElement("button");
  addBtn.className = "list-item";
  addBtn.textContent = "＋ Save Current Page";
  addBtn.onclick = addBookmark;
  bookmarkList.appendChild(addBtn);

  if (isIncognito) {
    const msg = document.createElement("button");
    msg.className = "list-item";
    msg.textContent = "Bookmarks disabled in incognito";
    bookmarkList.appendChild(msg);
    return;
  }

  const bookmarks = loadData("s_browser_bookmarks", []);

  if (!bookmarks.length) {
    const empty = document.createElement("button");
    empty.className = "list-item";
    empty.textContent = "No bookmarks yet";
    bookmarkList.appendChild(empty);
    return;
  }

  bookmarks.forEach(url => {
    const wrap = document.createElement("div");
    wrap.className = "bookmark-row";

    const openBtn = document.createElement("button");
    openBtn.className = "list-item";
    openBtn.textContent = url;
    openBtn.onclick = () => openUrlInTab(activeTabId, url);

    const delBtn = document.createElement("button");
    delBtn.className = "bookmark-delete";
    delBtn.textContent = "Del";
    delBtn.onclick = () => removeBookmark(url);

    wrap.appendChild(openBtn);
    wrap.appendChild(delBtn);
    bookmarkList.appendChild(wrap);
  });
}

function applyZoom(tabId) {
  const webview = document.querySelector(`.browser-view[data-tab-id="${tabId}"]`);
  if (!webview) return;

  const zoom = zoomLevels[tabId] || 1;
  try {
    webview.setZoomFactor(zoom);
  } catch (error) {
    console.error(error);
  }
}

function zoomIn() {
  if (!activeTabId) return;
  zoomLevels[activeTabId] = Math.min((zoomLevels[activeTabId] || 1) + 0.1, 3);
  applyZoom(activeTabId);
  setInfo("Zoom: " + Math.round(zoomLevels[activeTabId] * 100) + "%");
}

function zoomOut() {
  if (!activeTabId) return;
  zoomLevels[activeTabId] = Math.max((zoomLevels[activeTabId] || 1) - 0.1, 0.3);
  applyZoom(activeTabId);
  setInfo("Zoom: " + Math.round(zoomLevels[activeTabId] * 100) + "%");
}

function zoomReset() {
  if (!activeTabId) return;
  zoomLevels[activeTabId] = 1;
  applyZoom(activeTabId);
  setInfo("Zoom reset to 100%");
}

function toggleTheme() {
  if (document.body.dataset.theme === "dark") {
    document.body.dataset.theme = "light";
  } else {
    document.body.dataset.theme = "dark";
  }

  if (!isIncognito) {
    localStorage.setItem("s_browser_theme", document.body.dataset.theme);
  }
}

function loadTheme() {
  if (isIncognito) return;
  const theme = localStorage.getItem("s_browser_theme");
  if (theme === "light" || theme === "dark") {
    document.body.dataset.theme = theme;
  }
}

function loadSearchEngine() {
  if (isIncognito) return;
  const saved = localStorage.getItem("s_browser_search_engine");
  if (saved) searchEngine.value = saved;
}

searchEngine.addEventListener("change", () => {
  if (!isIncognito) {
    localStorage.setItem("s_browser_search_engine", searchEngine.value);
  }
});

addressBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    goToAddress();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    addressBar.focus();
    addressBar.select();
  }

  if (e.ctrlKey && e.key.toLowerCase() === "t") {
    e.preventDefault();
    newTab();
  }

  if (e.ctrlKey && e.key.toLowerCase() === "w") {
    e.preventDefault();
    closeCurrentTab();
  }

  if (e.ctrlKey && e.key.toLowerCase() === "r") {
    e.preventDefault();
    reloadTab();
  }

  if (e.ctrlKey && e.key === "+") {
    e.preventDefault();
    zoomIn();
  }

  if (e.ctrlKey && e.key === "-") {
    e.preventDefault();
    zoomOut();
  }

  if (e.ctrlKey && e.key === "0") {
    e.preventDefault();
    zoomReset();
  }
});

loadTheme();
loadSearchEngine();
newTab();
renderBookmarks();
renderHistory();
setInfo(isIncognito ? "Incognito mode active" : "Ready");
