// ========== State ==========
let currentLesson = null;
let flashcardIndex = 0;
let flashcardFlipped = false;
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizMaxQuestions = 20;
let isGeneralQuiz = false;

// ========== Storage ==========
const STATS_KEY = "nemacki-app-stats-v1";

const Stats = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    } catch {
      return {};
    }
  },
  save(data) {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  },
  add(lessonId, score, total) {
    const data = this.load();
    if (!data[lessonId]) data[lessonId] = [];
    data[lessonId].push({
      date: new Date().toISOString(),
      score,
      total,
    });
    this.save(data);
  },
  getLessonStats(lessonId) {
    const arr = this.load()[lessonId] || [];
    if (!arr.length) return null;
    const totalPlayed = arr.length;
    const avg =
      arr.reduce((s, r) => s + r.score / r.total, 0) / arr.length;
    const best = Math.max(...arr.map((r) => r.score / r.total));
    const last = arr[arr.length - 1];
    return { totalPlayed, avg, best, last };
  },
  getAllStats() {
    const data = this.load();
    let totalQuizzes = 0;
    let totalScore = 0;
    let totalQuestions = 0;
    Object.values(data).forEach((arr) => {
      arr.forEach((r) => {
        totalQuizzes++;
        totalScore += r.score;
        totalQuestions += r.total;
      });
    });
    return {
      totalQuizzes,
      totalScore,
      totalQuestions,
      avgPercent: totalQuestions ? totalScore / totalQuestions : 0,
    };
  },
  clear() {
    localStorage.removeItem(STATS_KEY);
  },
};

// ========== Init ==========
document.addEventListener("DOMContentLoaded", () => {
  goHome();
});

function goHome() {
  currentLesson = null;
  isGeneralQuiz = false;
  document.getElementById("homeBtn").classList.add("hidden");
  renderMenu();
}

function getApp() {
  return document.getElementById("app");
}

// ========== Helpers ==========
function getLessonCards(lessonId) {
  const lesson = APP_DATA.lessons.find((l) => l.id === lessonId);
  if (!lesson) return [];
  let cards = [];
  if (lesson.cards) cards = [...lesson.cards];
  else if (lesson.rows) {
    for (const row of lesson.rows) {
      if (row.length >= 3) cards.push({ front: row[0], read: row[1], back: row[2] });
      else if (row.length === 2) cards.push({ front: row[0], back: row[1] });
    }
  }
  return cards;
}

function getAllCards() {
  let cards = [];
  for (const lesson of APP_DATA.lessons) {
    if (lesson.cards) {
      cards.push(...lesson.cards.map((c) => ({ ...c, _lesson: lesson.title })));
    } else if (lesson.rows) {
      for (const row of lesson.rows) {
        if (row.length >= 3) cards.push({ front: row[0], read: row[1], back: row[2], _lesson: lesson.title });
        else if (row.length === 2) cards.push({ front: row[0], back: row[1], _lesson: lesson.title });
      }
    }
  }
  return cards;
}

function getQuizSizeOptions(cards) {
  const len = cards.length;
  const opts = [];
  if (len >= 5) opts.push(5);
  if (len >= 10) opts.push(10);
  if (len >= 15) opts.push(15);
  if (len >= 20) opts.push(20);
  opts.push(len);
  return [...new Set(opts)];
}

// ========== Speech ==========
function speakGerman(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// ========== Menu ==========
function renderMenu() {
  const app = getApp();
  const stats = Stats.getAllStats();
  let html = `
    <div class="stats-bar fade-in">
      <div class="stats-grid">
        <div class="stat-item"><div class="stat-num">${stats.totalQuizzes}</div><div class="stat-label">Kvizova</div></div>
        <div class="stat-item"><div class="stat-num">${stats.totalQuestions}</div><div class="stat-label">Pitanja</div></div>
        <div class="stat-item"><div class="stat-num">${Math.round((stats.avgPercent || 0) * 100)}%</div><div class="stat-label">Tačnost</div></div>
      </div>
      <button class="btn btn-outline btn-block mt-1" onclick="renderStats()">📊 Detaljna statistika</button>
    </div>
    <div class="text-center mb-2 mt-2">
      <h2 style="font-size:1.1rem;color:var(--text-light);">Izaberi lekciju</h2>
    </div>
    <div class="menu-grid">
      <div class="menu-card menu-card-special" onclick="startGeneralQuiz()" tabindex="0" role="button" aria-label="Generalni kviz">
        <div class="icon">🎯</div>
        <div class="title">Generalni kviz</div>
        <div class="subtitle">Sve lekcije zajedno</div>
      </div>
  `;
  for (const lesson of APP_DATA.lessons) {
    const s = Stats.getLessonStats(lesson.id);
    let badge = "";
    if (s) {
      badge = `<div class="lesson-badge">${Math.round(s.avg * 100)}% • ${s.totalPlayed}×</div>`;
    }
    html += `
      <div class="menu-card" onclick="openLesson('${lesson.id}')" tabindex="0" role="button" aria-label="${lesson.title}">
        <div class="icon">${lesson.icon}</div>
        <div class="title">${lesson.title}</div>
        ${badge}
      </div>
    `;
  }
  html += `</div>`;
  app.innerHTML = html;
}

// ========== Lesson Router ==========
function openLesson(id) {
  const lesson = APP_DATA.lessons.find((l) => l.id === id);
  if (!lesson) return;
  currentLesson = lesson;
  isGeneralQuiz = false;
  document.getElementById("homeBtn").classList.remove("hidden");

  if (lesson.type === "table") {
    renderTableLesson(lesson);
  } else if (lesson.type === "flashcards") {
    renderFlashcardsLesson(lesson);
  } else if (lesson.type === "info") {
    renderInfoLesson(lesson);
  } else if (lesson.type === "dialog") {
    renderDialogLesson(lesson);
  }
}

// ========== Table Lesson ==========
function renderTableLesson(lesson) {
  const app = getApp();
  let html = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${lesson.icon}</span>
      <div class="lesson-title">${lesson.title}</div>
    </div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="startTableFlashcards('${lesson.id}')">🎴 Kartice</button>
      <button class="btn btn-accent" onclick="startTableQuiz('${lesson.id}')">🧪 Kviz</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="data-table fade-in">
        <thead><tr>
  `;
  for (const col of lesson.columns) {
    html += `<th>${escapeHtml(col)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  for (const row of lesson.rows) {
    html += `<tr>`;
    for (const cell of row) {
      html += `<td>${escapeHtml(cell)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  app.innerHTML = html;
}

// ========== Info Lesson ==========
function renderInfoLesson(lesson) {
  const app = getApp();
  app.innerHTML = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${lesson.icon}</span>
      <div class="lesson-title">${lesson.title}</div>
    </div>
    <div class="info-block fade-in">
      ${lesson.html}
    </div>
  `;
}

// ========== Dialog Lesson ==========
function renderDialogLesson(lesson) {
  const app = getApp();
  let html = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${lesson.icon}</span>
      <div class="lesson-title">${lesson.title}</div>
    </div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="speakDialogAll()">🔊 Čitaj ceo dijalog</button>
    </div>
    <div class="dialog-block fade-in">
  `;
  for (let i = 0; i < lesson.lines.length; i++) {
    const line = lesson.lines[i];
    const cls = line.speaker === "A" ? "a" : "b";
    html += `
      <div class="dialog-line ${cls}">
        <div class="dialog-speaker">${escapeHtml(line.speaker)}</div>
        <div class="dialog-de">${escapeHtml(line.de)}</div>
        <div class="dialog-read">${escapeHtml(line.read)}</div>
        <div class="dialog-sr">${escapeHtml(line.sr)}</div>
        <button class="btn btn-outline mt-1" style="font-size:0.85rem;padding:0.3rem 0.6rem;" onclick="speakGerman('${escapeJs(line.de)}')">🔊 Čitaj</button>
      </div>
    `;
  }
  html += `</div>`;
  app.innerHTML = html;
}

function speakDialogAll() {
  if (!currentLesson || !currentLesson.lines) return;
  const text = currentLesson.lines.map((l) => l.de).join(". ");
  speakGerman(text);
}

// ========== Flashcards Lesson ==========
function renderFlashcardsLesson(lesson) {
  const app = getApp();
  app.innerHTML = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${lesson.icon}</span>
      <div class="lesson-title">${lesson.title}</div>
    </div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="startFlashcards('${lesson.id}')">🎴 Kartice za učenje</button>
      <button class="btn btn-accent" onclick="startFlashcardsQuiz('${lesson.id}')">🧪 Kviz</button>
    </div>
    <div class="data-table fade-in">
      <table style="width:100%;border-collapse:collapse;">
        <thead style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;">
          <tr><th>Nemački</th><th>Čita se</th><th>Srpski</th></tr>
        </thead>
        <tbody>
          ${lesson.cards
            .map(
              (c) =>
                `<tr><td>${escapeHtml(c.front)}</td><td>${escapeHtml(
                  c.read || ""
                )}</td><td>${escapeHtml(c.back)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ========== Flashcards Mode ==========
function startFlashcards(lessonId) {
  const lesson = APP_DATA.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  let cards = [];
  if (lesson.cards) cards = lesson.cards;
  else if (lesson.rows) {
    for (const row of lesson.rows) {
      if (row.length >= 3) {
        cards.push({ front: row[0], read: row[1], back: row[2] });
      } else if (row.length === 2) {
        cards.push({ front: row[0], back: row[1] });
      }
    }
  }
  if (cards.length === 0) return;
  currentLesson = { ...lesson, _cards: cards };
  flashcardIndex = 0;
  flashcardFlipped = false;
  renderFlashcardView();
}

function startTableFlashcards(lessonId) {
  startFlashcards(lessonId);
}

function renderFlashcardView() {
  const app = getApp();
  const cards = currentLesson._cards;
  const card = cards[flashcardIndex];
  app.innerHTML = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${currentLesson.icon}</span>
      <div class="lesson-title">${currentLesson.title}</div>
    </div>
    <div class="flashcard-area fade-in">
      <div class="flashcard" id="fc" onclick="flipCard()">
        <button class="audio-btn" onclick="event.stopPropagation();speakGerman('${escapeJs(card.front)}')">🔊</button>
        <div class="front-text">${escapeHtml(card.front)}</div>
        ${card.read ? `<div class="read-text">${escapeHtml(card.read)}</div>` : ""}
        <div class="back-text hidden" id="fcBack">${escapeHtml(card.back)}</div>
        <div class="hint">Dodirni karticu da okreneš</div>
      </div>
    </div>
    <div class="flashcard-controls">
      <button class="btn btn-outline" onclick="prevCard()">◀ Prethodna</button>
      <button class="btn btn-primary" onclick="flipCard()">🔄 Okreni</button>
      <button class="btn btn-outline" onclick="nextCard()">Sledeća ▶</button>
    </div>
    <div class="flashcard-progress">${flashcardIndex + 1} / ${cards.length}</div>
  `;
}

function flipCard() {
  flashcardFlipped = !flashcardFlipped;
  const fc = document.getElementById("fc");
  const back = document.getElementById("fcBack");
  if (!fc || !back) return;
  if (flashcardFlipped) {
    fc.classList.add("flipped");
    back.classList.remove("hidden");
  } else {
    fc.classList.remove("flipped");
    back.classList.add("hidden");
  }
}

function nextCard() {
  const cards = currentLesson._cards;
  flashcardIndex = (flashcardIndex + 1) % cards.length;
  flashcardFlipped = false;
  renderFlashcardView();
}

function prevCard() {
  const cards = currentLesson._cards;
  flashcardIndex = (flashcardIndex - 1 + cards.length) % cards.length;
  flashcardFlipped = false;
  renderFlashcardView();
}

// ========== Quiz Mode ==========
function startFlashcardsQuiz(lessonId) {
  showQuizSizePicker(lessonId, false);
}

function startTableQuiz(lessonId) {
  showQuizSizePicker(lessonId, false);
}

function startGeneralQuiz() {
  showQuizSizePicker("general", true);
}

function showQuizSizePicker(lessonId, general) {
  const cards = general ? getAllCards() : getLessonCards(lessonId);
  if (cards.length < 4) {
    alert("Nema dovoljno podataka za kviz (potrebno bar 4).");
    return;
  }
  isGeneralQuiz = general;
  const opts = getQuizSizeOptions(cards);
  const title = general ? "🎯 Generalni kviz" : "🧪 Kviz";
  const subtitle = general
    ? "Pitanja iz svih lekcija"
    : APP_DATA.lessons.find((l) => l.id === lessonId)?.title || "";

  let html = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">${title.split(" ")[0]}</span>
      <div class="lesson-title">${title.replace(/^\S+\s/, "")}</div>
    </div>
    <div class="text-center fade-in" style="padding:1rem;">
      <p style="color:var(--text-light);margin-bottom:1rem;">${subtitle}<br>Dostupno pitanja: <strong>${cards.length}</strong></p>
      <p style="font-weight:600;margin-bottom:0.75rem;">Izaberi broj pitanja:</p>
      <div class="btn-group" style="justify-content:center;">
        ${opts
          .map(
            (n) =>
              `<button class="btn btn-primary" onclick="startQuizWithSize('${lessonId}', ${n}, ${general})">${n === cards.length ? "Sve" : n}</button>`
          )
          .join("")}
      </div>
      <button class="btn btn-outline mt-2" onclick="goHome()">↩ Nazad</button>
    </div>
  `;
  getApp().innerHTML = html;
}

function startQuizWithSize(lessonId, size, general) {
  const cards = general ? getAllCards() : getLessonCards(lessonId);
  if (general) {
    currentLesson = { id: "general", title: "Generalni kviz", icon: "🎯" };
  } else {
    currentLesson = APP_DATA.lessons.find((l) => l.id === lessonId);
  }
  quizMaxQuestions = size;
  isGeneralQuiz = general;
  buildQuiz(cards);
}

function buildQuiz(cards) {
  quizQuestions = [];
  const allBacks = cards.map((c) => c.back);
  for (const card of cards) {
    const wrong = shuffle(allBacks.filter((b) => b !== card.back)).slice(0, 3);
    const options = shuffle([card.back, ...wrong]);
    quizQuestions.push({
      question: card.front,
      read: card.read || "",
      options,
      correct: card.back,
      lesson: card._lesson || currentLesson.title,
    });
  }
  quizQuestions = shuffle(quizQuestions).slice(
    0,
    Math.min(quizQuestions.length, quizMaxQuestions)
  );
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  renderQuiz();
}

function renderQuiz() {
  const app = getApp();
  if (quizIndex >= quizQuestions.length) {
    // Save stats
    Stats.add(currentLesson.id, quizScore, quizQuestions.length);

    const pct = Math.round((quizScore / quizQuestions.length) * 100);
    let emoji = "🏆";
    if (pct < 50) emoji = "💪";
    else if (pct < 80) emoji = "🥉";
    else if (pct < 100) emoji = "🥈";

    app.innerHTML = `
      <div class="text-center fade-in" style="padding:2rem 1rem;">
        <div style="font-size:3rem;">${emoji}</div>
        <h2 style="margin:1rem 0;">Kviz završen!</h2>
        <p class="quiz-score">Tačnih odgovora: <strong>${quizScore}</strong> / ${quizQuestions.length}</p>
        <p class="quiz-score" style="font-size:1.4rem;color:var(--accent);">${pct}%</p>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-primary" onclick="startQuizWithSize('${currentLesson.id}', ${quizMaxQuestions}, ${isGeneralQuiz})">🔄 Ponovi kviz</button>
          <button class="btn btn-outline" onclick="${isGeneralQuiz ? "goHome()" : "openLesson('" + currentLesson.id + "')"}">${isGeneralQuiz ? "🏠 Početak" : "📖 Nazad na lekciju"}</button>
        </div>
      </div>
    `;
    return;
  }

  const q = quizQuestions[quizIndex];
  const isGeneral = isGeneralQuiz;
  app.innerHTML = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">🧪</span>
      <div class="lesson-title">${isGeneral ? "Generalni kviz" : "Kviz — " + currentLesson.title}</div>
    </div>
    <div class="quiz-score">Pitanje ${quizIndex + 1} / ${quizQuestions.length} &nbsp;|&nbsp; Tačnih: ${quizScore}</div>
    ${isGeneral ? `<div style="text-align:center;font-size:0.8rem;color:var(--text-light);margin-bottom:0.5rem;">${escapeHtml(q.lesson)}</div>` : ""}
    <div class="quiz-question fade-in">
      <div class="quiz-question-text">${escapeHtml(q.question)}</div>
      ${q.read ? `<div class="quiz-read">${escapeHtml(q.read)}</div>` : ""}
      <button class="btn btn-outline mt-1" style="font-size:0.9rem;" onclick="speakGerman('${escapeJs(q.question)}')">🔊 Poslušaj</button>
    </div>
    <div class="quiz-options">
      ${q.options
        .map(
          (opt, i) =>
            `<button class="quiz-option" id="opt${i}" onclick="selectQuizOption(${i})">${escapeHtml(opt)}</button>`
        )
        .join("")}
    </div>
    <div id="quizFeedback" class="text-center mt-2" style="min-height:1.5rem;font-weight:600;"></div>
    <div class="btn-group" style="justify-content:center;margin-top:1rem;">
      <button class="btn btn-primary hidden" id="quizNext" onclick="nextQuizQuestion()">Sledeće pitanje ▶</button>
    </div>
  `;
}

function selectQuizOption(idx) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q = quizQuestions[quizIndex];
  const chosen = q.options[idx];
  const isCorrect = chosen === q.correct;
  if (isCorrect) quizScore++;

  for (let i = 0; i < q.options.length; i++) {
    const btn = document.getElementById("opt" + i);
    if (!btn) continue;
    btn.classList.add("disabled");
    if (q.options[i] === q.correct) btn.classList.add("correct");
    else if (i === idx) btn.classList.add("wrong");
  }

  const fb = document.getElementById("quizFeedback");
  if (fb) {
    fb.textContent = isCorrect
      ? "✅ Tačno!"
      : "❌ Netačno. Tačan odgovor: " + q.correct;
    fb.style.color = isCorrect ? "var(--accent)" : "var(--danger)";
  }

  const nxt = document.getElementById("quizNext");
  if (nxt) nxt.classList.remove("hidden");
}

function nextQuizQuestion() {
  quizIndex++;
  quizAnswered = false;
  renderQuiz();
}

// ========== Stats ==========
function renderStats() {
  document.getElementById("homeBtn").classList.remove("hidden");
  const app = getApp();
  const all = Stats.getAllStats();

  if (all.totalQuizzes === 0) {
    app.innerHTML = `
      <div class="lesson-header">
        <span style="font-size:1.8rem;">📊</span>
        <div class="lesson-title">Statistika</div>
      </div>
      <div class="text-center fade-in" style="padding:2rem;">
        <div style="font-size:3rem;">📭</div>
        <p>Još nemaš odigranih kvizova.<br>Odigraj kviz da vidiš statistiku ovde!</p>
        <button class="btn btn-primary mt-2" onclick="goHome()">🏠 Nazad na početak</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="lesson-header">
      <span style="font-size:1.8rem;">📊</span>
      <div class="lesson-title">Statistika</div>
    </div>
    <div class="stats-summary fade-in">
      <div class="stats-grid">
        <div class="stat-item"><div class="stat-num">${all.totalQuizzes}</div><div class="stat-label">Ukupno kvizova</div></div>
        <div class="stat-item"><div class="stat-num">${all.totalQuestions}</div><div class="stat-label">Ukupno pitanja</div></div>
        <div class="stat-item"><div class="stat-num">${Math.round((all.avgPercent || 0) * 100)}%</div><div class="stat-label">Tačnost</div></div>
      </div>
    </div>
    <div class="stats-details fade-in">
      <h3 style="margin:1.5rem 0 0.75rem;color:var(--primary);">Po lekcijama</h3>
  `;

  for (const lesson of APP_DATA.lessons) {
    const s = Stats.getLessonStats(lesson.id);
    if (!s) continue;
    html += `
      <div class="stat-row">
        <div class="stat-row-title">${lesson.icon} ${lesson.title}</div>
        <div class="stat-row-bars">
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${Math.round(s.avg * 100)}%"></div></div>
          <div class="stat-row-meta">Prosek: ${Math.round(s.avg * 100)}% | Najbolji: ${Math.round(s.best * 100)}% | ${s.totalPlayed} pokušaja</div>
        </div>
      </div>
    `;
  }

  const g = Stats.getLessonStats("general");
  if (g) {
    html += `
      <div class="stat-row">
        <div class="stat-row-title">🎯 Generalni kviz</div>
        <div class="stat-row-bars">
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${Math.round(g.avg * 100)}%"></div></div>
          <div class="stat-row-meta">Prosek: ${Math.round(g.avg * 100)}% | Najbolji: ${Math.round(g.best * 100)}% | ${g.totalPlayed} pokušaja</div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  html += `
    <div class="btn-group" style="justify-content:center;margin-top:1.5rem;">
      <button class="btn btn-danger" onclick="if(confirm('Sigurno želiš da obrišeš svu statistiku?')){Stats.clear();goHome();}">🗑️ Obriši statistiku</button>
      <button class="btn btn-outline" onclick="goHome()">🏠 Nazad</button>
    </div>
  `;
  app.innerHTML = html;
}

// ========== Utilities ==========
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str) return "";
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
