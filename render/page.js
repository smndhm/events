// In the browser, as the page is read: what has passed is hidden. The page is built in the morning, and read at any time
// of the day, or after midnight. Without this script, the page shows everything, as it was built.
// - An event whose end has passed (`data-ends`, written by render/page.ts) is hidden.
// - A film's showtime that has started (`data-starts`) is taken out; a cinema left without any, its line; a film left
//   without any cinema that day ends at its last showtime, so it is hidden as an event.
// - A day's category counts its events left, and is hidden without any; a day counts all of them, and is hidden without
//   any. The days are named again: after midnight, "Demain" is "Aujourd'hui".
// - An event stays new for the page's days (`data-new-days`) after it was first seen (`data-first-seen`), then loses its
//   mark. "Seulement les nouveautés" checked, the counts are of the new events only, and a line says when there are none.
// Then again every minute, and as the box is checked, while the page is open. A classic script, deferred: a module would not run from a file.

const TIME_ZONE = 'Europe/Paris';

// The day in Paris, as YYYY-MM-DD; Sweden writes its dates as ISO does
const parisDay = date => date.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });

const atNoon = day => new Date(`${day}T12:00:00Z`);

const addDays = (day, days) => {
  const date = atNoon(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// As render/format.ts names them. A day gone by, which only keeps the events still on, such as a garage sale until
// Sunday, read after midnight and before the next build: "En cours"
const dayTitle = (day, today) => {
  if (day < today) return 'En cours';
  if (day === today) return "Aujourd'hui";
  if (day === addDays(today, 1)) return 'Demain';
  const title = dayFormat.format(atNoon(day));
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const hasPassed = (date, now) => new Date(date) <= now;

const DAY = 86_400_000;

const update = (page, now = new Date()) => {
  for (const times of page.querySelectorAll('.showings__times')) {
    const left = [...times.querySelectorAll('[data-starts]')].filter(link => !hasPassed(link.dataset.starts, now));
    times.replaceChildren(...left.flatMap((link, index) => (index > 0 ? [', ', link] : [link])));
    const theater = times.closest('.showings__theater');
    if (theater) theater.hidden = left.length === 0;
  }
  const newDays = Number(page.querySelector('[data-new-days]')?.dataset.newDays ?? 0);
  for (const event of page.querySelectorAll('.event[data-ends]')) {
    event.hidden = hasPassed(event.dataset.ends, now);
    const fresh = now - new Date(event.dataset.firstSeen) < newDays * DAY;
    event.toggleAttribute('data-new', fresh);
    const mark = event.querySelector('.event__new');
    if (mark) mark.hidden = !fresh;
  }
  const onlyNew = page.querySelector('#only-new')?.checked ?? false;
  const shown = event => !event.hidden && (!onlyNew || event.hasAttribute('data-new'));
  for (const category of page.querySelectorAll('.day__category')) {
    const left = [...category.querySelectorAll('.event')].filter(shown).length;
    const count = category.querySelector('.day__count');
    if (count) count.textContent = String(left);
    category.hidden = left === 0;
  }
  const today = parisDay(now);
  for (const day of page.querySelectorAll('.day[data-day]')) {
    const left = [...day.querySelectorAll('.event')].filter(shown).length;
    day.hidden = left === 0;
    const total = day.querySelector('.day__total');
    if (total) total.textContent = String(left);
    const title = day.querySelector('.day__title');
    if (title) title.textContent = dayTitle(day.dataset.day, today);
  }
  // The new events, each once, however many days it is under
  const fresh = new Set([...page.querySelectorAll('.event[data-new]:not([hidden])')].map(event => event.dataset.event));
  const news = page.querySelector('.news__count');
  if (news) news.textContent = String(fresh.size);
  const empty = page.querySelector('.news__empty');
  if (empty) empty.hidden = !onlyNew || fresh.size > 0;
};

update(document);
document.querySelector('#only-new')?.addEventListener('change', () => update(document));
setInterval(() => update(document), 60_000);
