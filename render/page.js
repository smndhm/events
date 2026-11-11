// In the browser, as the page is read: what has passed is hidden. The page is built in the morning, and read at any time
// of the day, or after midnight. Without this script, the page shows everything, as it was built.
// - An event whose end has passed (`data-ends`, written by render/page.ts) is hidden.
// - A film's showtime that has started (`data-starts`) is taken out; a cinema left without any, its line; a film left
//   without any cinema that day ends at its last showtime, so it is hidden as an event.
// - A day's category counts its events left, and is hidden without any; a day counts all of them, and is hidden without
//   any. The days are named again: after midnight, "Demain" is "Aujourd'hui".
// - Today's categories are open, once, as the page opens.
// Then again every minute, while the page is open. A classic script, deferred: a module would not run from a file.

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

const hidePast = (page, now = new Date()) => {
  for (const times of page.querySelectorAll('.showings__times')) {
    const left = [...times.querySelectorAll('[data-starts]')].filter(link => !hasPassed(link.dataset.starts, now));
    times.replaceChildren(...left.flatMap((link, index) => (index > 0 ? [', ', link] : [link])));
    const theater = times.closest('.showings__theater');
    if (theater) theater.hidden = left.length === 0;
  }
  for (const event of page.querySelectorAll('.event[data-ends]')) {
    event.hidden = hasPassed(event.dataset.ends, now);
  }
  for (const category of page.querySelectorAll('.day__category')) {
    const left = category.querySelectorAll('.event:not([hidden])').length;
    const count = category.querySelector('.day__count');
    if (count) count.textContent = String(left);
    category.hidden = left === 0;
  }
  const today = parisDay(now);
  for (const day of page.querySelectorAll('.day[data-day]')) {
    const left = day.querySelectorAll('.event:not([hidden])').length;
    day.hidden = left === 0;
    const total = day.querySelector('.day__total');
    if (total) total.textContent = String(left);
    const title = day.querySelector('.day__title');
    if (title) title.textContent = dayTitle(day.dataset.day, today);
  }
};

// Today's categories open, read after midnight too: once, as the page opens, not to open again every minute what the
// visitor folded
const openToday = (page, now = new Date()) => {
  for (const category of page.querySelectorAll(`.day[data-day="${parisDay(now)}"] .day__category`)) category.open = true;
};

openToday(document);
hidePast(document);
setInterval(() => hidePast(document), 60_000);
