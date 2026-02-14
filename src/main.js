// ===== MathQuest - Main Application =====
import './style.css';

// Import exercise data
import enterosData from './data/enteros.json';
import potenciasData from './data/potencias.json';
import fraccionesData from './data/fracciones.json';
import fraccionesOpsData from './data/fracciones-ops.json';
import porcentajesData from './data/porcentajes.json';
import probabilidadData from './data/probabilidad.json';
import algebraData from './data/algebra.json';

// ===== State =====
const topics = [enterosData, potenciasData, fraccionesData, fraccionesOpsData, porcentajesData, probabilidadData, algebraData];

const state = {
  screen: 'home', // home | round | feedback | batchFeedback | help | results
  currentTopic: null,
  currentRound: [],
  currentExerciseIndex: 0,
  roundResults: [],
  capturedImage: null,
  capturedMimeType: null,
  isEvaluating: false,
  feedbackData: null,
  helpData: null,
  liveXP: 0, // XP earned during current round (shown live in header)
};

// ===== Storage (progress persistence) =====
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem('mathquest_progress')) || {};
  } catch { return {}; }
}

function saveProgress(progress) {
  localStorage.setItem('mathquest_progress', JSON.stringify(progress));
}

function getTopicProgress(topicName) {
  const progress = loadProgress();
  return progress[topicName] || { xp: 0, correct: 0, total: 0, bestStreak: 0 };
}

function updateTopicProgress(topicName, roundXP, roundCorrect, roundTotal, streak) {
  const progress = loadProgress();
  const current = progress[topicName] || { xp: 0, correct: 0, total: 0, bestStreak: 0 };
  current.xp += roundXP;
  current.correct += roundCorrect;
  current.total += roundTotal;
  current.bestStreak = Math.max(current.bestStreak, streak);
  progress[topicName] = current;
  saveProgress(progress);
}

function getTotalXP() {
  const progress = loadProgress();
  return Object.values(progress).reduce((sum, p) => sum + (p.xp || 0), 0);
}

function getTotalStreak() {
  const progress = loadProgress();
  return Math.max(0, ...Object.values(progress).map(p => p.bestStreak || 0));
}

function getTopicStars(topicName) {
  const p = getTopicProgress(topicName);
  if (p.total === 0) return 0;
  const pct = p.correct / p.total;
  if (pct >= 0.9) return 3;
  if (pct >= 0.75) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

// ===== Helpers =====
function isBatchExercise(exercise) {
  return exercise.type === 'batch' && Array.isArray(exercise.items);
}

function formatMath(text) {
  if (!text) return '';
  // Replace fractions like 1/2, 48/72 with vertical layout
  return text.replace(/(\d+)\s*\/\s*(\d+)/g,
    '<span class="fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>');
}

// ===== Confetti =====
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#FF6B6B', '#FFD700', '#00E676', '#00D4FF', '#A55EEA', '#FF9F43', '#5F6CFF'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 15,
      vy: Math.random() * -18 - 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.3,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.opacity -= 0.008;

      if (p.opacity > 0 && p.y < canvas.height + 50) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    frame++;
    if (alive && frame < 180) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

// ===== Rendering =====
const app = document.getElementById('app');

function render() {
  switch (state.screen) {
    case 'home': renderHome(); break;
    case 'round': renderRound(); break;
    case 'feedback': renderFeedback(); break;
    case 'batchFeedback': renderBatchFeedback(); break;
    case 'help': renderHelp(); break;
    case 'results': renderResults(); break;
  }
}

// --- Header ---
function renderHeader() {
  const totalXP = getTotalXP() + state.liveXP;
  return `
    <header class="header">
      <div class="header__logo" onclick="window.__goHome()">
        <span class="header__logo-icon">🧮</span>
        <span>MathQuest</span>
      </div>
      <div class="header__stats">
        <div class="stat">
          <span class="stat__icon">⚡</span>
          <span class="stat__value">${totalXP} XP</span>
        </div>
      </div>
    </header>
  `;
}

// --- Home Screen ---
function renderHome() {
  const topicCards = topics.map((topic, idx) => {
    const progress = getTopicProgress(topic.topic);
    const stars = getTopicStars(topic.topic);
    const pct = progress.total > 0 ? Math.round((progress.correct / progress.total) * 100) : 0;
    const starsHTML = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    // Count exercises properly (batch = 1 exercise unit)
    const exerciseCount = topic.exercises.length;

    return `
      <div class="topic-card" style="--topic-color: ${topic.color}" onclick="window.__selectTopic(${idx})" data-topic="${idx}">
        <span class="topic-card__icon">${topic.icon}</span>
        <div class="topic-card__name">${topic.topic}</div>
        <div class="topic-card__count">${exerciseCount} ejercicios disponibles</div>
        <div class="topic-card__progress">
          <div class="progress-bar">
            <div class="progress-bar__fill" style="width: ${pct}%; background: ${topic.color}"></div>
          </div>
          <span class="topic-card__stars">${starsHTML}</span>
        </div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    ${renderHeader()}
    <a href="/admin.html" class="admin-link">🛠️ Admin</a>
    <div class="home">
      <h1 class="home__title">¡A por las mates! 💪</h1>
      <p class="home__subtitle">Elige un tema y completa rondas de 5 ejercicios</p>
      <div class="topics-grid">
        ${topicCards}
      </div>
    </div>
  `;
}

// --- Round Screen ---
function renderRound() {
  const exercise = state.currentRound[state.currentExerciseIndex];
  const topic = state.currentTopic;
  const num = state.currentExerciseIndex + 1;
  const total = state.currentRound.length;

  // Progress dots
  const dots = state.currentRound.map((_, i) => {
    let cls = 'progress-dot';
    if (i === state.currentExerciseIndex) cls += ' progress-dot--active';
    else if (state.roundResults[i]?.correcto === true) cls += ' progress-dot--correct';
    else if (state.roundResults[i]?.correcto === false) cls += ' progress-dot--incorrect';
    return `<div class="${cls}"></div>`;
  }).join('');

  // Evaluating state
  if (state.isEvaluating) {
    app.innerHTML = `
      ${renderHeader()}
      <div class="round">
        <div class="round__header">
          <div class="round__topic-badge">${topic.icon} ${topic.topic}</div>
          <h2 class="round__title">Ejercicio ${num} de ${total}</h2>
          <div class="round__progress-dots">${dots}</div>
        </div>
        <div class="evaluating">
          <div class="evaluating__spinner"></div>
          <div class="evaluating__text">🤖 Analizando tu respuesta...</div>
          <div class="evaluating__subtext">Gemini está evaluando</div>
        </div>
      </div>
    `;
    return;
  }

  // === BATCH EXERCISE ===
  if (isBatchExercise(exercise)) {
    const allowInput = exercise.allowInput;

    const itemsHTML = exercise.items.map((item, i) => `
        <div class="batch-item">
          <span class="batch-item__num">${i + 1}</span>
          <span class="batch-item__statement">${formatMath(item.statement)}</span>
          <span class="batch-item__equals">=</span>
          ${allowInput
        ? `<input type="text" class="batch-input" data-index="${i}" placeholder="?" autocomplete="off" />`
        : ''}
        </div>
      `).join('');

    let actionSection = '';
    if (allowInput) {
      actionSection = `
          <div class="photo-section">
            <p class="photo-section__title">📝 Escribe los resultados y pulsa Enviar</p>
            <button class="btn btn--primary btn--large" onclick="window.__evaluateBatchText()">
              🚀 Enviar Respuestas
            </button>
          </div>
        `;
    } else {
      // Photo preview (shared logic adapted)
      let photoHTML = state.capturedImage ? `
          <div class="photo-preview">
            <img src="${state.capturedImage}" alt="Tu solución" />
          </div>
          <div class="photo-actions">
            <button class="btn btn--secondary" onclick="window.__clearPhoto()">🔄 Otra foto</button>
            <button class="btn btn--success btn--large" onclick="window.__evaluate()">🚀 ¡Evaluar!</button>
          </div>
        ` : `
          <div class="photo-actions">
            <button class="btn btn--primary btn--large" onclick="document.getElementById('photo-input').click()">
              <span class="btn--icon">📸</span> Sacar / Subir foto
            </button>
          </div>
          <input type="file" id="photo-input" class="file-input" accept="image/*" capture="environment" onchange="window.__onPhotoSelected(event)" />
        `;

      actionSection = `
          <div class="photo-section">
            <p class="photo-section__title">📝 Resuelve los 5 en papel y saca UNA foto con todos los resultados</p>
            ${photoHTML}
          </div>
        `;
    }

    app.innerHTML = `
      ${renderHeader()}
      <div class="round">
        <div class="round__header">
          <div class="round__topic-badge">${topic.icon} ${topic.topic}</div>
          <h2 class="round__title">Ejercicio ${num} de ${total}</h2>
          <div class="round__progress-dots">${dots}</div>
        </div>

        <div class="exercise-card exercise-card--batch">
          <div class="batch-badge">📋 5 cálculos rápidos</div>
          <div class="batch-title">${exercise.batchTitle}</div>
          <div class="batch-list">
            ${itemsHTML}
          </div>
        </div>

        ${actionSection}

        <div class="help-section">
          <button class="btn btn--help" onclick="window.__askHelp()">
            🤷 No sé cómo hacerlo
          </button>
        </div>
      </div>
    `;
    return;
  }

  // === SINGLE EXERCISE ===
  const allowInput = exercise.allowInput;
  let actionSection = '';

  if (allowInput) {
    actionSection = `
        <div class="photo-section">
            <p class="photo-section__title">📝 Escribe tu respuesta</p>
            <div style="display:flex; gap:0.5rem; justify-content:center;">
                <input type="text" id="text-input" class="text-input" placeholder="Respuesta..." autocomplete="off" style="font-size:1.2rem; padding:0.5rem; border-radius:8px; border:1px solid #555; background:#222; color:white; width:150px; text-align:center;" />
                <button class="btn btn--primary" onclick="window.__evaluateText()">🚀 Enviar</button>
            </div>
        </div>
      `;
  } else {
    let photoHTML = state.capturedImage ? `
          <div class="photo-preview">
            <img src="${state.capturedImage}" alt="Tu solución" />
          </div>
          <div class="photo-actions">
            <button class="btn btn--secondary" onclick="window.__clearPhoto()">
              <span class="btn--icon">🔄</span> Otra foto
            </button>
            <button class="btn btn--success btn--large" onclick="window.__evaluate()">
              <span class="btn--icon">🚀</span> ¡Evaluar!
            </button>
          </div>
        ` : `
          <div class="photo-actions">
            <button class="btn btn--primary btn--large" onclick="document.getElementById('photo-input').click()">
              <span class="btn--icon">📸</span> Sacar / Subir foto
            </button>
          </div>
          <input type="file" id="photo-input" class="file-input" accept="image/*" capture="environment" onchange="window.__onPhotoSelected(event)" />
        `;

    actionSection = `
        <div class="photo-section">
          <p class="photo-section__title">📝 Resuélvelo en papel y saca una foto a tu respuesta</p>
          ${photoHTML}
        </div>
      `;
  }

  app.innerHTML = `
    ${renderHeader()}
    <div class="round">
      <div class="round__header">
        <div class="round__topic-badge">${topic.icon} ${topic.topic}</div>
        <h2 class="round__title">Ejercicio ${num} de ${total}</h2>
        <div class="round__progress-dots">${dots}</div>
      </div>

      <div class="exercise-card">
        <span class="exercise-card__number">${num}</span>
        <div class="exercise-card__statement">${formatMath(exercise.statement)}</div>
      </div>

      ${actionSection}

      <div class="help-section">
        <button class="btn btn--help" onclick="window.__askHelp()">
          🤷 No sé cómo hacerlo
        </button>
      </div>
    </div>
  `;
}

// --- Feedback Screen (single exercise) ---
function renderFeedback() {
  const fb = state.feedbackData;
  const isCorrect = fb.correcto;
  const isLastExercise = state.currentExerciseIndex >= state.currentRound.length - 1;

  let xpGained = 0;
  if (isCorrect) {
    xpGained = 100;
  }
  // Update live XP in header
  state.liveXP += xpGained;

  const emojiCorrect = ['🎉', '🥳', '🌟', '💪', '🏆', '🚀'][Math.floor(Math.random() * 6)];
  const emojiIncorrect = ['💡', '🤔', '📚', '🧐'][Math.floor(Math.random() * 4)];

  const stepsHTML = fb.pasos && fb.pasos.length > 0
    ? `<div class="feedback__section">
        <div class="feedback__section-title">📋 Resolución paso a paso</div>
        <ol class="feedback__steps">
          ${fb.pasos.map(p => `<li>${formatMath(p)}</li>`).join('')}
        </ol>
      </div>` : '';

  const trickHTML = fb.truco
    ? `<div class="feedback__section">
        <details class="feedback__trick-toggle">
          <summary class="feedback__trick-summary">💡 Ver truco para recordar</summary>
          <div class="feedback__trick">
            <span class="feedback__trick-icon">🧠</span> ${fb.truco}
          </div>
        </details>
      </div>` : '';

  const nextLabel = isLastExercise ? '📊 Ver resultados' : '➡️ Siguiente ejercicio';
  const retryHTML = !isCorrect
    ? `<button class="btn btn--secondary" onclick="window.__retryExercise()">🔄 Reintentar</button>`
    : '';

  app.innerHTML = `
    ${renderHeader()}
    <div class="feedback">
      <div class="feedback__result feedback__result--${isCorrect ? 'correct' : 'incorrect'}">
        <span class="feedback__emoji">${isCorrect ? emojiCorrect : emojiIncorrect}</span>
        <div class="feedback__message">${fb.mensaje || (isCorrect ? '¡Correcto!' : 'No del todo...')}</div>
        ${isCorrect ? `<div class="feedback__xp">+${xpGained} XP</div>` : ''}
      </div>

      <div class="feedback__details">
        <div class="feedback__section">
          <div class="feedback__section-title">✏️ Tu respuesta</div>
          <div class="feedback__interpreted">${formatMath(fb.respuestaAlumno || 'No detectada')}</div>
        </div>

        <div class="feedback__section">
          <div class="feedback__section-title">${isCorrect ? '✅ Explicación' : '❌ ¿Dónde está el error?'}</div>
          <div class="feedback__section-content">${formatMath(fb.explicacion || '')}</div>
        </div>

        ${stepsHTML}
        ${trickHTML}
      </div>

      <div class="feedback__actions">
        ${retryHTML}
        <button class="btn btn--primary btn--large" onclick="window.__nextExercise()">
          ${nextLabel}
        </button>
      </div>
    </div>
  `;
}

// --- Batch Feedback Screen ---
function renderBatchFeedback() {
  const fb = state.feedbackData; // { resultados: [...], resumen, truco }
  const exercise = state.currentRound[state.currentExerciseIndex];
  const isLastExercise = state.currentExerciseIndex >= state.currentRound.length - 1;

  const resultados = fb.resultados || [];
  const correctCount = resultados.filter(r => r.correcto).length;
  const totalItems = exercise.items.length;
  const allCorrect = correctCount === totalItems;

  let xpGained = correctCount * 20; // 20 XP per correct item in batch
  if (allCorrect) xpGained += 50; // bonus for all correct
  // Update live XP in header
  state.liveXP += xpGained;

  const itemsHTML = resultados.map((r, i) => {
    const item = exercise.items[i] || {};
    const icon = r.correcto ? '✅' : '❌';
    const cls = r.correcto ? 'batch-result--correct' : 'batch-result--incorrect';
    return `
      <div class="batch-result ${cls}">
        <span class="batch-result__icon">${icon}</span>
        <span class="batch-result__statement">${formatMath(item.statement || '')} =</span>
        <span class="batch-result__answer">${formatMath(r.respuestaAlumno || '?')}</span>
        ${!r.correcto ? `<span class="batch-result__correct-answer">→ ${formatMath(item.answer || '')}</span>` : ''}
      </div>
    `;
  }).join('');

  const trickHTML = fb.truco
    ? `<div class="feedback__section">
        <details class="feedback__trick-toggle">
          <summary class="feedback__trick-summary">💡 Ver truco para recordar</summary>
          <div class="feedback__trick">
            <span class="feedback__trick-icon">🧠</span> ${fb.truco}
          </div>
        </details>
      </div>` : '';

  const nextLabel = isLastExercise ? '📊 Ver resultados' : '➡️ Siguiente ejercicio';
  const retryHTML = !allCorrect
    ? `<button class="btn btn--secondary" onclick="window.__retryExercise()">🔄 Reintentar</button>`
    : '';

  // Store aggregate result for round scoring
  state.roundResults[state.currentExerciseIndex] = {
    correcto: allCorrect,
    batchCorrect: correctCount,
    batchTotal: totalItems,
  };

  app.innerHTML = `
    ${renderHeader()}
    <div class="feedback">
      <div class="feedback__result feedback__result--${allCorrect ? 'correct' : correctCount > 0 ? 'partial' : 'incorrect'}">
        <span class="feedback__emoji">${allCorrect ? '🌟' : correctCount >= 3 ? '💪' : '📚'}</span>
        <div class="feedback__message">${fb.resumen || `${correctCount}/${totalItems} correctas`}</div>
        <div class="feedback__xp">+${xpGained} XP</div>
        <div class="feedback__batch-score">${correctCount} de ${totalItems} aciertos</div>
      </div>

      <div class="feedback__details">
        <div class="feedback__section">
          <div class="feedback__section-title">📋 Resultados detallados</div>
          <div class="batch-results-list">
            ${itemsHTML}
          </div>
        </div>

        ${fb.explicacion ? `<div class="feedback__section">
          <div class="feedback__section-title">📝 Comentarios</div>
          <div class="feedback__section-content">${fb.explicacion}</div>
        </div>` : ''}

        ${trickHTML}
      </div>

      <div class="feedback__actions">
        ${retryHTML}
        <button class="btn btn--primary btn--large" onclick="window.__nextExercise()">
          ${nextLabel}
        </button>
      </div>
    </div>
  `;
}

// --- Results Screen ---
function renderResults() {
  const topic = state.currentTopic;
  let totalCorrect = 0;
  let totalItems = 0;
  let roundXP = 0;

  state.roundResults.forEach(r => {
    if (!r) return;
    if (r.skipped) { // If exercise was skipped for help, it counts as incorrect
      totalItems += 1;
      // XP is 0 for skipped exercises
    } else if (r.batchTotal) {
      // Batch exercise
      totalCorrect += r.batchCorrect;
      totalItems += r.batchTotal;
      roundXP += r.batchCorrect * 20;
      if (r.batchCorrect === r.batchTotal) roundXP += 50;
    } else {
      // Single exercise
      totalItems += 1;
      if (r.correcto) {
        totalCorrect += 1;
        roundXP += 100;
      }
    }
  });

  const pct = totalItems > 0 ? Math.round((totalCorrect / totalItems) * 100) : 0;

  // Streak calc from round results
  let maxStreak = 0;
  let currentStreak = 0;
  state.roundResults.forEach(r => {
    if (r?.correcto || (r?.batchTotal && r.batchCorrect === r.batchTotal)) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  // Save progress
  updateTopicProgress(topic.topic, roundXP, totalCorrect, totalItems, maxStreak);

  let starsEarned = 0;
  if (pct >= 90) starsEarned = 3;
  else if (pct >= 75) starsEarned = 2;
  else if (pct >= 50) starsEarned = 1;

  const trophy = pct === 100 ? '🏆' : pct >= 75 ? '🥇' : pct >= 50 ? '🥈' : '💪';
  const starsHTML = '⭐'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);

  const messages = pct === 100
    ? '¡RONDA PERFECTA! ¡Eres un/a crack de las mates!'
    : pct >= 75
      ? '¡Muy bien! Casi lo dominas por completo.'
      : pct >= 50
        ? '¡Buen trabajo! Sigue practicando para mejorar.'
        : '¡No te rindas! Cada intento te hace más fuerte.';

  app.innerHTML = `
    ${renderHeader()}
    <div class="results">
      <span class="results__trophy">${trophy}</span>
      <h2 class="results__title">Ronda completada</h2>
      <p class="results__subtitle">${messages}</p>

      <div class="results__stars">${starsHTML}</div>

      <div class="results__stats">
        <div class="results__stat">
          <div class="results__stat-value results__stat-value--xp">+${roundXP}</div>
          <div class="results__stat-label">XP ganados</div>
        </div>
        <div class="results__stat">
          <div class="results__stat-value results__stat-value--correct">${totalCorrect}/${totalItems}</div>
          <div class="results__stat-label">Aciertos</div>
        </div>
        <div class="results__stat">
          <div class="results__stat-value results__stat-value--streak">🔥 ${maxStreak}</div>
          <div class="results__stat-label">Mejor racha</div>
        </div>
      </div>

      <div class="results__actions">
        <button class="btn btn--secondary btn--large" onclick="window.__goHome()">
          🏠 Menú principal
        </button>
        <button class="btn btn--primary btn--large" onclick="window.__newRound()">
          🔄 Otra ronda
        </button>
      </div>
    </div>
  `;

  // Celebrate on good performance
  if (pct >= 60) {
    setTimeout(launchConfetti, 300);
  }
}

// ===== Actions =====
window.__goHome = () => {
  state.screen = 'home';
  state.currentTopic = null;
  state.currentRound = [];
  state.currentExerciseIndex = 0;
  state.roundResults = [];
  state.capturedImage = null;
  state.capturedMimeType = null;
  state.isEvaluating = false;
  state.feedbackData = null;
  state.helpData = null;
  state.liveXP = 0;
  render();
};

window.__selectTopic = (idx) => {
  state.currentTopic = topics[idx];
  startNewRound();
};

function startNewRound() {
  const exercises = [...state.currentTopic.exercises];
  // Separate batch and single exercises
  const batchExercises = exercises.filter(e => e.type === 'batch');
  const singleExercises = exercises.filter(e => e.type !== 'batch');

  // Shuffle both pools
  batchExercises.sort(() => Math.random() - 0.5);
  singleExercises.sort(() => Math.random() - 0.5);

  // Build round: prioritize batch (take 3-4 batch if available, fill rest with single)
  let round = [];
  const batchCount = Math.min(batchExercises.length, 3);
  round.push(...batchExercises.slice(0, batchCount));
  const remaining = 5 - round.length;
  round.push(...singleExercises.slice(0, remaining));

  // If still < 5, fill with more batch
  if (round.length < 5) {
    round.push(...batchExercises.slice(batchCount, batchCount + (5 - round.length)));
  }

  // Shuffle final order
  round.sort(() => Math.random() - 0.5);
  state.currentRound = round.slice(0, 5);
  state.currentExerciseIndex = 0;
  state.roundResults = [];
  state.capturedImage = null;
  state.capturedMimeType = null;
  state.feedbackData = null;
  state.helpData = null;
  state.liveXP = 0;
  state.screen = 'round';
  render();
}

window.__newRound = () => {
  startNewRound();
};

window.__onPhotoSelected = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.capturedImage = e.target.result; // data URL
    state.capturedMimeType = file.type || 'image/jpeg';
    render();
  };
  reader.readAsDataURL(file);
};

window.__clearPhoto = () => {
  state.capturedImage = null;
  state.capturedMimeType = null;
  render();
};

window.__evaluate = async () => {
  if (!state.capturedImage) return;

  state.isEvaluating = true;
  render();

  const exercise = state.currentRound[state.currentExerciseIndex];
  const base64Data = state.capturedImage.split(',')[1];

  try {
    let endpoint, body;

    if (isBatchExercise(exercise)) {
      // Batch evaluation
      endpoint = '/api/evaluate-batch';
      body = {
        imageBase64: base64Data,
        mimeType: state.capturedMimeType,
        batchTitle: exercise.batchTitle,
        items: exercise.items,
        hints: exercise.hints,
      };
    } else {
      // Single evaluation
      endpoint = '/api/evaluate';
      body = {
        imageBase64: base64Data,
        mimeType: state.capturedMimeType,
        statement: exercise.statement,
        expectedAnswer: exercise.answer,
        hints: exercise.hints,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    state.feedbackData = data;
    state.isEvaluating = false;

    if (isBatchExercise(exercise)) {
      const correctCount = (data.resultados || []).filter(r => r.correcto).length;
      state.roundResults[state.currentExerciseIndex] = {
        correcto: correctCount === exercise.items.length,
        batchCorrect: correctCount,
        batchTotal: exercise.items.length,
      };
      if (correctCount === exercise.items.length) launchConfetti();
      state.screen = 'batchFeedback';
    } else {
      state.roundResults[state.currentExerciseIndex] = data;
      if (data.correcto) launchConfetti();
      state.screen = 'feedback';
    }

    render();
  } catch (err) {
    console.error('Error evaluando:', err);
    state.isEvaluating = false;
    state.feedbackData = {
      correcto: false,
      respuestaAlumno: 'Error de conexión',
      mensaje: '⚠️ No se pudo conectar con el servidor. ¿Está el servidor ejecutándose? (npm run server)',
      explicacion: `Error técnico: ${err.message}. Asegúrate de que el servidor está corriendo con: node server.js`,
      truco: '',
      pasos: [],
    };
    state.roundResults[state.currentExerciseIndex] = state.feedbackData;
    state.screen = 'feedback';
    render();
  }
};

window.__evaluateText = async () => {
  const input = document.getElementById('text-input');
  if (!input || !input.value.trim()) return;
  const answer = input.value.trim();

  state.isEvaluating = true;
  render();

  const exercise = state.currentRound[state.currentExerciseIndex];
  const topic = state.currentTopic;

  try {
    const response = await fetch('/api/evaluate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: exercise.statement,
        userAnswer: answer,
        correctAnswer: exercise.answer,
        topic: topic.topic
      })
    });

    if (!response.ok) throw new Error('Error evaluando');
    const data = await response.json();

    state.feedbackData = data;
    state.isEvaluating = false;
    state.roundResults[state.currentExerciseIndex] = data;

    if (data.correcto) launchConfetti();
    state.screen = 'feedback';
    render();

  } catch (err) {
    console.error(err);
    state.isEvaluating = false;
    alert('Error al evaluar: ' + err.message);
    state.screen = 'round';
    render();
  }
};

window.__evaluateBatchText = async () => {
  const inputs = document.querySelectorAll('.batch-input');
  const answers = Array.from(inputs).map(inp => inp.value.trim());

  // Allow partial submission? Yes.

  state.isEvaluating = true;
  render();

  const exercise = state.currentRound[state.currentExerciseIndex];
  const topic = state.currentTopic;

  try {
    const response = await fetch('/api/evaluate-batch-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: exercise.items,
        userAnswers: answers,
        topic: topic.topic
      })
    });

    if (!response.ok) throw new Error('Error evaluando lote');
    const data = await response.json();

    state.feedbackData = data;
    state.isEvaluating = false;

    const correctCount = (data.resultados || []).filter(r => r.correcto).length;
    state.roundResults[state.currentExerciseIndex] = {
      correcto: correctCount === exercise.items.length,
      batchCorrect: correctCount,
      batchTotal: exercise.items.length
    };

    if (correctCount === exercise.items.length) launchConfetti();
    state.screen = 'batchFeedback';
    render();

  } catch (err) {
    console.error(err);
    state.isEvaluating = false;
    alert('Error al evaluar lote: ' + err.message);
    state.screen = 'round';
    render();
  }
};

// ===== Help: "No sé" button =====
window.__askHelp = async () => {
  state.isEvaluating = true;
  render();

  const exercise = state.currentRound[state.currentExerciseIndex];

  try {
    let body;
    if (isBatchExercise(exercise)) {
      body = { isBatch: true, batchTitle: exercise.batchTitle, items: exercise.items, hints: exercise.hints };
    } else {
      body = { statement: exercise.statement, expectedAnswer: exercise.answer, hints: exercise.hints };
    }

    const response = await fetch('/api/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Error: ${response.status}`);

    const data = await response.json();
    state.helpData = data;
    state.isEvaluating = false;

    // Count as incorrect (they didn't solve it)
    state.roundResults[state.currentExerciseIndex] = { correcto: false, skipped: true };

    state.screen = 'help';
    render();
  } catch (err) {
    console.error('Error pidiendo ayuda:', err);
    state.isEvaluating = false;
    state.helpData = {
      mensaje: 'Error al conectar con el servidor.',
      explicacion: err.message,
      pasos: [],
      truco: ''
    };
    state.screen = 'help';
    render();
  }
};

// --- Help Screen ---
function renderHelp() {
  const hd = state.helpData;
  const exercise = state.currentRound[state.currentExerciseIndex];
  const isLastExercise = state.currentExerciseIndex >= state.currentRound.length - 1;
  const nextLabel = isLastExercise ? '📊 Ver resultados' : '➡️ Siguiente ejercicio';

  const stepsHTML = hd.pasos && hd.pasos.length > 0
    ? `<div class="feedback__section">
        <div class="feedback__section-title">📋 Resolución paso a paso</div>
        <ol class="feedback__steps">
          ${hd.pasos.map(p => `<li>${p}</li>`).join('')}
        </ol>
      </div>` : '';

  const trickHTML = hd.truco
    ? `<div class="feedback__section">
        <details class="feedback__trick-toggle">
          <summary class="feedback__trick-summary">💡 Ver truco para recordar</summary>
          <div class="feedback__trick">
            <span class="feedback__trick-icon">🧠</span> ${hd.truco}
          </div>
        </details>
      </div>` : '';

  // Show the exercise statement(s) as reminder
  let exerciseReminder = '';
  if (isBatchExercise(exercise)) {
    exerciseReminder = exercise.items.map((item, i) =>
      `<div class="help-exercise-item"><strong>${i + 1}.</strong> ${formatMath(item.statement)} = <strong>${formatMath(item.answer)}</strong></div>`
    ).join('');
  } else {
    exerciseReminder = `<div class="help-exercise-item"><strong>${formatMath(exercise.statement)}</strong><br>Respuesta: <strong>${formatMath(exercise.answer)}</strong></div>`;
  }

  app.innerHTML = `
    ${renderHeader()}
    <div class="feedback">
      <div class="feedback__result feedback__result--help">
        <span class="feedback__emoji">📖</span>
        <div class="feedback__message">${hd.mensaje || '¡Vamos a aprenderlo juntos!'}</div>
      </div>

      <div class="feedback__details">
        <div class="feedback__section">
          <div class="feedback__section-title">📝 Ejercicio</div>
          <div class="feedback__section-content">${exerciseReminder}</div>
        </div>

        <div class="feedback__section">
          <div class="feedback__section-title">📚 Explicación</div>
          <div class="feedback__section-content">${hd.explicacion || ''}</div>
        </div>

        ${stepsHTML}
        ${trickHTML}
      </div>

      <div class="feedback__actions">
        <button class="btn btn--primary btn--large" onclick="window.__nextExercise()">
          ${nextLabel}
        </button>
      </div>
    </div>
  `;
}

window.__retryExercise = () => {
  state.capturedImage = null;
  state.capturedMimeType = null;
  state.feedbackData = null;
  state.helpData = null; // Clear help data on retry
  state.screen = 'round';
  render();
};

window.__nextExercise = () => {
  if (state.currentExerciseIndex >= state.currentRound.length - 1) {
    state.screen = 'results';
    render();
    return;
  }

  state.currentExerciseIndex++;
  state.capturedImage = null;
  state.capturedMimeType = null;
  state.feedbackData = null;
  state.screen = 'round';
  render();
};

// ===== Init =====
render();
