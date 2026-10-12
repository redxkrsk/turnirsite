'use strict';
// Все данные организатора находятся в отдельном файле конфигурации.
const config = window.TOURNAMENT_CONFIG;
// При недоступности Unsplash используем сохранённые копии этих же фотографий.
document.querySelectorAll('img[data-fallback]').forEach(img => {
  const fallback = () => { if (img.dataset.fallback) { const path = img.dataset.fallback; delete img.dataset.fallback; img.src = path; } };
  img.addEventListener('error', fallback, { once: true });
  if (img.complete && img.naturalWidth === 0) fallback();
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const form = document.querySelector('#registration-form');
const submitButton = form.querySelector('[type="submit"]');
const status = document.querySelector('#form-status');
const storageKey = 'redx-arena-demo-registrations';
let sending = false;
document.querySelectorAll('[data-tournament-date]').forEach(el => { el.textContent = config.dateLabel; });

// Мобильная навигация: управление мышью и клавиатурой.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() { navigation.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { const open = navigation.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

// Таймер использует абсолютное время с явным часовым поясом.
function updateCountdown() {
  const remaining = Math.max(0, new Date(config.startsAt).getTime() - Date.now());
  const seconds = Math.floor(remaining / 1000);
  const values = { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = String(value).padStart(2, '0'); });
  if (!remaining) document.querySelector('#countdown-status').textContent = 'Турнир начался';
  const closed = Date.now() >= new Date(config.registrationDeadline).getTime();
  submitButton.disabled = closed || sending;
  if (closed) status.textContent = 'Регистрация завершена. До встречи на следующем турнире!';
}
updateCountdown(); setInterval(updateCountdown, 1000);

// Появление секций и счётчиков без постоянных обработчиков прокрутки.
if ('IntersectionObserver' in window) {
  if (!reducedMotion) document.body.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible'); observer.unobserve(entry.target);
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  const counters = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    counters.unobserve(entry.target);
    const target = Number(entry.target.dataset.counter);
    if (reducedMotion) return;
    const start = performance.now();
    function animate(now) {
      const progress = Math.min(1, (now - start) / 1200);
      entry.target.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3))).toLocaleString('ru-RU');
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }), { threshold: 0.5 });
  document.querySelectorAll('[data-counter]').forEach(el => counters.observe(el));
}

// Небольшое количество частиц вместо тяжёлой внешней библиотеки.
if (!reducedMotion) {
  const canvas = document.querySelector('#particles');
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, frame = 0;
  const points = Array.from({ length: 32 }, () => ({ x: Math.random(), y: Math.random(), size: Math.random() * 1.4 + 0.5, speed: Math.random() * 0.00015 + 0.00005 }));
  function resize() { width = canvas.clientWidth; height = canvas.clientHeight; const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function draw() { ctx.clearRect(0, 0, width, height); points.forEach(p => { p.y = (p.y - p.speed + 1) % 1; ctx.fillStyle = 'rgba(177,133,255,0.45)'; ctx.beginPath(); ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2); ctx.fill(); }); frame = requestAnimationFrame(draw); }
  resize(); window.addEventListener('resize', resize); draw();
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(frame); if (!document.hidden) draw(); });
}

// Расписание обеих дисциплин. Пары определяются после жеребьёвки.
const schedules = {
  cs2: [['24 ОКТ', '12:00', 'Открытие и жеребьёвка', 'Знакомство с командами · Проверка серверов', 'Все команды', 'СТАРТ'], ['24 ОКТ', '13:00', 'Групповой этап', 'Первые матчи и борьба за выход в плей-офф', '5 × 5 · BO1', 'КВАЛИФИКАЦИЯ'], ['24 ОКТ', '17:00', 'Плей-офф', 'Верхняя и нижняя сетка', 'Double elimination', 'ПЛЕЙ-ОФФ'], ['24 ОКТ', '21:00', 'Гранд-финал', 'Последний раунд. Время забрать своё.', '5 × 5 · BO3', 'ФИНАЛ']],
  dota2: [['24 ОКТ', '12:00', 'Открытие и жеребьёвка', 'Проверка лобби и подтверждение составов', 'Все команды', 'СТАРТ'], ['24 ОКТ', '13:30', 'Групповой этап', 'Первый драфт и первые победы', '5 × 5 · BO1', 'КВАЛИФИКАЦИЯ'], ['24 ОКТ', '17:30', 'Плей-офф', 'Верхняя и нижняя сетка', 'Double elimination', 'ПЛЕЙ-ОФФ'], ['24 ОКТ', '21:30', 'Гранд-финал', 'Последняя битва за трон.', '5 × 5 · BO3', 'ФИНАЛ']]
};
function renderSchedule(game) {
  const list = document.querySelector('#schedule-list'); list.replaceChildren();
  schedules[game].forEach(([date, time, title, description, format, badge], index) => {
    const row = document.createElement('article'); row.className = 'schedule-row' + (index === 3 ? ' final' : '');
    // Значения расписания заданы разработчиком, пользовательские данные сюда не попадают.
    row.innerHTML = `<div class="schedule-date">${date}<strong>${time}</strong></div><div><h3>${title}</h3><p>${description}</p></div><span class="schedule-format">${format}</span><span class="schedule-badge">${badge}</span>`;
    list.append(row);
  });
}
renderSchedule('cs2');
document.querySelectorAll('[data-schedule]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-schedule]').forEach(el => { const active = el === button; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
  renderSchedule(button.dataset.schedule);
}));
document.querySelectorAll('[data-game]').forEach(link => link.addEventListener('click', () => { form.elements.discipline.value = link.dataset.game; }));

// Discord не подменяется чужим сервером: виджет создаётся только с ID организатора.
if (/^\d{17,20}$/.test(config.discordServerId)) {
  const iframe = document.createElement('iframe');
  iframe.src = `https://discord.com/widget?id=${encodeURIComponent(config.discordServerId)}&theme=dark`;
  iframe.title = 'Сообщество REDX ARENA в Discord'; iframe.loading = 'lazy';
  iframe.sandbox = 'allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts';
  document.querySelector('#discord-widget').append(iframe);
  document.querySelector('#discord-status').textContent = 'Лобби, новости и поиск тиммейтов в нашем Discord.';
}
try {
  const url = new URL(config.discordInvite);
  if (url.protocol === 'https:' && ['discord.gg', 'discord.com'].includes(url.hostname)) {
    const link = document.querySelector('#discord-link'); link.href = url.href; link.hidden = false;
  }
} catch { /* При отсутствии ссылки не показываем неработающий переход. */ }
const partnerLink = document.querySelector('.partner-logos>a');
if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.partnerEmail)) partnerLink.href = `mailto:${config.partnerEmail}`;
else { partnerLink.removeAttribute('href'); partnerLink.textContent = 'Контакт скоро появится ↗'; }

// Валидация с доступными сообщениями и фокусом на первом ошибочном поле.
const validators = {
  nickname: value => value.length >= 2 ? '' : 'Укажите никнейм: минимум 2 символа.',
  team: value => value.length >= 2 ? '' : 'Укажите название команды: минимум 2 символа.',
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Введите корректный email.',
  discord: value => /^[a-z0-9_.]{2,32}$/.test(value) ? '' : 'Discord: 2–32 символа, латинские строчные буквы, цифры, _ или точка.'
};
function validateField(name) {
  const input = form.elements[name]; const error = validators[name](input.value.trim());
  document.getElementById(`${name}-error`).textContent = error;
  input.setAttribute('aria-invalid', String(Boolean(error))); input.setAttribute('aria-describedby', `${name}-error`);
  return !error;
}
Object.keys(validators).forEach(name => { form.elements[name].addEventListener('blur', () => validateField(name)); form.elements[name].addEventListener('input', () => { if (form.elements[name].getAttribute('aria-invalid') === 'true') validateField(name); }); });
form.elements.consent.addEventListener('change', () => { document.querySelector('#consent-error').textContent = ''; });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (sending) return;
  if (Date.now() >= new Date(config.registrationDeadline).getTime()) { updateCountdown(); return; }
  status.textContent = '';
  const invalid = Object.keys(validators).filter(name => !validateField(name));
  if (!form.elements.consent.checked) { document.querySelector('#consent-error').textContent = 'Подтвердите согласие с условиями.'; invalid.push('consent'); }
  if (invalid.length) { form.elements[invalid[0]].focus(); return; }
  const data = Object.fromEntries(new FormData(form));
  ['nickname', 'team', 'email', 'discord'].forEach(name => { data[name] = data[name].trim(); });
  data.createdAt = new Date().toISOString();
  sending = true; submitButton.disabled = true;
  try {
    if (config.registrationEndpoint) {
      const endpoint = new URL(config.registrationEndpoint);
      if (endpoint.protocol !== 'https:') throw new Error('Для приёма заявок нужен защищённый HTTPS-адрес.');
      const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Не удалось отправить заявку. Попробуйте ещё раз позже.');
    } else {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved)) throw new Error('Не удалось прочитать локальные заявки. Удалите их в условиях демоверсии.');
      if (saved.some(item => item.email?.toLowerCase() === data.email.toLowerCase() && item.discipline === data.discipline)) throw new Error('Демозаявка с этим email уже сохранена для выбранной дисциплины.');
      saved.push(data); localStorage.setItem(storageKey, JSON.stringify(saved));
    }
    document.querySelector('#confirmation-title').textContent = config.registrationEndpoint ? 'Заявка отправлена!' : 'Демозаявка сохранена!';
    document.querySelector('#confirmation-message').textContent = config.registrationEndpoint ? `Команда «${data.team}»: заявка передана организаторам. Дождитесь подтверждения участия.` : `Команда «${data.team}»: данные сохранены только в этом браузере. Организаторам заявка не отправлена.`;
    document.querySelector('#confirmation').showModal(); form.reset();
  } catch (error) { status.textContent = error instanceof DOMException && error.name === 'QuotaExceededError' ? 'Не хватает места в браузере. Удалите старые демозаявки.' : error.message || 'Не удалось сохранить заявку.'; }
  finally { sending = false; updateCountdown(); }
});
if (config.registrationEndpoint) document.querySelector('#form-mode').textContent = 'Заявка будет отправлена организатору турнира.';

// Нативные диалоги удерживают фокус и закрываются клавишей Escape.
document.querySelector('#rules-button').addEventListener('click', () => document.querySelector('#rules').showModal());
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
});
document.querySelector('.dialog-done').addEventListener('click', () => document.querySelector('#confirmation').close());
document.querySelector('#delete-data').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); document.querySelector('#delete-status').textContent = 'Демозаявки удалены из этого браузера.'; }
  catch { document.querySelector('#delete-status').textContent = 'Браузер запретил доступ к локальному хранилищу.'; }
});
