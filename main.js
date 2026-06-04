const SIZE = 7;
const TARGET_SCORE = 360;
const toxins = [
  { id: 0, icon: "焦", name: "焦油", bg: "linear-gradient(145deg,#201714,#5a3426)", msg: "成功消除焦油！焦油會黏附肺部，讓呼吸道更難保持清淨。" },
  { id: 1, icon: "尼", name: "尼古丁", bg: "linear-gradient(145deg,#2a1d3d,#6d43a3)", msg: "成功消除尼古丁！尼古丁會造成依賴，讓身體被菸品綁住。" },
  { id: 2, icon: "CO", name: "一氧化碳", bg: "linear-gradient(145deg,#1b2638,#55616f)", msg: "成功消除一氧化碳！它會搶走血液中的氧氣，使心臟更吃力。" },
  { id: 3, icon: "氨", name: "阿摩尼亞", bg: "linear-gradient(145deg,#243718,#6e8b2e)", msg: "成功消除阿摩尼亞！刺激性氣體會讓呼吸道不舒服，咳嗽更明顯。" },
  { id: 4, icon: "鉛", name: "重金屬", bg: "linear-gradient(145deg,#232326,#70757f)", msg: "成功消除重金屬！有害金屬會增加身體負擔，影響多個器官。" },
  { id: 5, icon: "醛", name: "甲醛", bg: "linear-gradient(145deg,#3a1720,#9e3949)", msg: "成功消除甲醛！刺激黏膜與呼吸道，也與致癌風險有關。" }
];

const boardEl = document.getElementById("board");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const toast = document.getElementById("toast");
const startScreen = document.getElementById("startScreen");
const winScreen = document.getElementById("winScreen");
const startBtn = document.getElementById("startBtn");
const againBtn = document.getElementById("againBtn");
const resetBtn = document.getElementById("resetBtn");

let board = [];
let selected = null;
let startTouch = null;
let score = 0;
let locked = false;
let active = false;


function setAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 250));
document.addEventListener("touchmove", event => event.preventDefault(), { passive: false });


function randomTile() {
  return Math.floor(Math.random() * toxins.length);
}


function resetGame(showStart = false) {
  score = 0;
  selected = null;
  locked = false;
  active = !showStart;
  winScreen.classList.remove("show");
  startScreen.classList.toggle("show", showStart);
  board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => randomTile()));
  removeStartingMatches();
  render();
  updateProgress();
  setToast("滑動相鄰方塊，連成 3 個以上相同毒素即可消除。");
}


function removeStartingMatches() {
  let changed = true;
  while (changed) {
    changed = false;
    const matches = findMatches();
    if (!matches.length) break;
    matches.flat().forEach(({ r, c }) => {
      board[r][c] = randomTile();
      changed = true;
    });
  }
}


function render() {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const toxin = toxins[board[r][c]];
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.dataset.r = r;
      tile.dataset.c = c;
      tile.style.setProperty("--tile-bg", toxin.bg);
      tile.innerHTML = `${toxin.icon}<small>${toxin.name}</small>`;
      tile.setAttribute("aria-label", toxin.name);
      bindTile(tile);
      boardEl.appendChild(tile);
    }
  }
}


function bindTile(tile) {
  tile.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (!active || locked) return;
    startTouch = { x: event.clientX, y: event.clientY, r: +tile.dataset.r, c: +tile.dataset.c };
    selectTile(startTouch.r, startTouch.c);
  });

  tile.addEventListener("pointerup", event => {
    event.preventDefault();
    if (!active || locked || !startTouch) return;
    const dx = event.clientX - startTouch.x;
    const dy = event.clientY - startTouch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      const dir = Math.abs(dx) > Math.abs(dy)
        ? { dr: 0, dc: dx > 0 ? 1 : -1 }
        : { dr: dy > 0 ? 1 : -1, dc: 0 };
      trySwap(startTouch.r, startTouch.c, startTouch.r + dir.dr, startTouch.c + dir.dc);
    }
    startTouch = null;
  });

  tile.addEventListener("click", event => {
    event.preventDefault();
    if (!active || locked) return;
    const r = +tile.dataset.r;
    const c = +tile.dataset.c;
    if (!selected) {
      selectTile(r, c);
      return;
    }
    if (selected.r === r && selected.c === c) {
      selected = null;
      render();
      return;
    }
    if (Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1) {
      trySwap(selected.r, selected.c, r, c);
    } else {
      selectTile(r, c);
    }
  });
}

function selectTile(r, c) {
  selected = { r, c };
  [...boardEl.children].forEach(child => {
    child.classList.toggle("selected", +child.dataset.r === r && +child.dataset.c === c);
  });
}


async function trySwap(r1, c1, r2, c2) {
  if (r2 < 0 || c2 < 0 || r2 >= SIZE || c2 >= SIZE) return;
  locked = true;
  swap(r1, c1, r2, c2);
  selected = null;
  render();
  await sleep(90);
  

  if (!findMatches().length) {
    swap(r1, c1, r2, c2);
    render();
    setToast("沒有形成連線，資料繩索回彈。");
    locked = false;
    return;
  }
  await resolveBoard();
  locked = false;
}

function swap(r1, c1, r2, c2) {
  const temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}


async function resolveBoard() {
  let matches = findMatches();
  while (matches.length) {
    const unique = new Map();
    matches.flat().forEach(cell => unique.set(`${cell.r},${cell.c}`, cell));
    const cells = [...unique.values()];
    const toxinId = board[cells[0].r][cells[0].c];
    
    markClearing(cells);
    score += cells.length * 10;
    updateProgress();
    setToast(`<b>${toxins[toxinId].name}</b> 已轉化為清淨氧氣<br>${toxins[toxinId].msg}`);
    
    await sleep(360); 
    cells.forEach(({ r, c }) => board[r][c] = null);
    collapse();
    render();
    await sleep(120); 
    matches = findMatches(); 
  }
  if (score >= TARGET_SCORE) {
    active = false;
    winScreen.classList.add("show");
  }
}

function markClearing(cells) {
  const set = new Set(cells.map(cell => `${cell.r},${cell.c}`));
  [...boardEl.children].forEach(tile => {
    if (set.has(`${tile.dataset.r},${tile.dataset.c}`)) tile.classList.add("clearing");
  });
}


function collapse() {
  for (let c = 0; c < SIZE; c++) {
    const kept = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      if (board[r][c] !== null) kept.push(board[r][c]);
    }
    for (let r = SIZE - 1; r >= 0; r--) {
      board[r][c] = kept.shift();
      if (board[r][c] === undefined) board[r][c] = randomTile();
    }
  }
}


function findMatches() {
  const matches = [];
  for (let r = 0; r < SIZE; r++) {
    let run = [{ r, c: 0 }];
    for (let c = 1; c < SIZE; c++) {
      if (board[r][c] !== null && board[r][c] === board[r][c - 1]) run.push({ r, c });
      else {
        if (run.length >= 3) matches.push(run);
        run = [{ r, c }];
      }
    }
    if (run.length >= 3) matches.push(run);
  }

 
  for (let c = 0; c < SIZE; c++) {
    let run = [{ r: 0, c }];
    for (let r = 1; r < SIZE; r++) {
      if (board[r][c] !== null && board[r][c] === board[r - 1][c]) run.push({ r, c });
      else {
        if (run.length >= 3) matches.push(run);
        run = [{ r, c }];
      }
    }
    if (run.length >= 3) matches.push(run);
  }
  return matches;
}

function updateProgress() {
  const progress = Math.min(100, Math.floor(score / TARGET_SCORE * 100));
  progressText.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
}

function setToast(html) {
  toast.innerHTML = html;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function bindPress(element, action) {
  let last = 0;
  element.addEventListener("pointerdown", event => {
    event.preventDefault();
    last = Date.now();
    action();
  });
  element.addEventListener("click", event => {
    event.preventDefault();
    if (Date.now() - last < 350) return;
    action();
  });
}


bindPress(startBtn, () => {
  startScreen.classList.remove("show");
  active = true;
  setToast("滑動相鄰方塊，連成 3 個以上相同毒素即可消除。");
});
bindPress(againBtn, () => resetGame(false));
bindPress(resetBtn, () => resetGame(false));


resetGame(true);