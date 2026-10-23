<script lang="ts">
  // Calendar: Today lanes (default), 3-day, week (Sunday to Saturday), month. Read-only. Swipe on the body
  // changes the period; the arrows do the same.
  import { IconButton, Button, Segmented, Sheet, pressable } from '../../lib/ui';
  import type { ViewProps } from '../../lib/legacy.svelte';
  import type { CalEvent } from '../../lib/state/calendar.svelte';
  import { openEvent } from './openEvent.svelte';
  import Day from './Day.svelte';
  import ThreeDay from './ThreeDay.svelte';
  import Week from './Week.svelte';
  import Month from './Month.svelte';

  type Mode = 'day' | '3day' | 'week' | 'month';
  const MODES: { value: Mode; label: string }[] = [
    { value: 'day', label: 'Today' },
    { value: '3day', label: '3 Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  let { active }: ViewProps = $props();
  const App = window.App;

  let mode = $state<Mode>('day');
  let date = $state.raw(App.dayStart(App.now()));
  let now = $state.raw(App.now());
  let more = $state.raw<CalEvent[] | null>(null);
  let moreOpen = $state(false);

  // Every minute (and when the demo clock jumps) while visible.
  $effect(() => {
    if (!active) return;
    const tick = () => (now = App.now());
    const jump = () => {
      date = App.dayStart(App.now());
      tick();
    };
    tick();
    App.on('minute', tick);
    App.on('time', jump);
    return () => {
      App.off('minute', tick);
      App.off('time', jump);
    };
  });

  // The week view shows the Sunday-to-Saturday week that contains `date`.
  const weekStart = $derived(App.addDays(date, -date.getDay()));

  const title = $derived.by(() => {
    const d = mode === 'week' ? weekStart : date;
    if (mode === 'day') {
      const rel = App.sameDay(d, now) ? 'Today' : App.fmt.rel(d);
      return { k: `${App.fmt.month(d)} ${d.getFullYear()} · ${rel}`, t: App.fmt.day(d), i: String(d.getDate()) };
    }
    if (mode === '3day') {
      const e = App.addDays(d, 2);
      return {
        k: `${App.fmt.month(d)} ${d.getFullYear()}`,
        t: `${App.fmt.dayShort(d)} ${d.getDate()}`,
        i: '–',
        t2: `${App.fmt.dayShort(e)} ${e.getDate()}`,
      };
    }
    if (mode === 'week') {
      const w = App.addDays(d, 6);
      return {
        k: String(w.getFullYear()),
        t: `${App.fmt.monthShort(d)} ${d.getDate()}`,
        i: '–',
        t2: `${App.fmt.monthShort(w)} ${w.getDate()}`,
      };
    }
    return { k: String(d.getFullYear()), t: App.fmt.month(d) };
  });

  const isToday = $derived.by(() => {
    if (mode === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (mode === 'week') return App.sameDay(weekStart, App.addDays(now, -now.getDay()));
    return App.sameDay(date, now);
  });

  function nav(dir: number) {
    if (mode === 'month') date = new Date(date.getFullYear(), date.getMonth() + dir, 1);
    else date = App.addDays(date, dir * { day: 1, '3day': 3, week: 7 }[mode]);
  }

  function today() {
    date = App.dayStart(App.now());
  }

  // Keeps `date`: switching modes shows the period around the same day.
  function setMode(m: Mode) {
    mode = m;
  }

  function openDay(d: Date) {
    date = App.dayStart(d);
    mode = 'day';
  }

  function openMore(list: CalEvent[]) {
    more = list;
    moreOpen = true;
  }

  function pickMore(e: CalEvent) {
    moreOpen = false;
    openEvent(App.findEvent(e.id));
  }

  // Swipe: the same as the arrows. Passive, tracked on the body only.
  let sx = 0;
  let sy = 0;
  let st = 0;
  let tracking = false;
  function down(e: PointerEvent) {
    sx = e.clientX;
    sy = e.clientY;
    st = Date.now();
    tracking = true;
  }
  function up(e: PointerEvent) {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 60 && Date.now() - st < 700) nav(dx < 0 ? 1 : -1);
  }
  function cancel() {
    tracking = false;
  }
  function swipe(el: HTMLElement) {
    el.addEventListener('pointerdown', down, { passive: true });
    el.addEventListener('pointerup', up, { passive: true });
    el.addEventListener('pointercancel', cancel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }
</script>

<div class="cal">
  <header class="cal-head">
    <IconButton icon="left" label="Previous" onclick={() => nav(-1)} />
    <div class="cal-title">
      <div class="serif">{title.t}{#if title.i}&nbsp;<i>{title.i}</i>{/if}{#if title.t2}&nbsp;{title.t2}{/if}</div>
      <div class="label">{title.k}</div>
    </div>
    <IconButton icon="right" label="Next" onclick={() => nav(1)} />
    <div class="cal-today" style:visibility={isToday ? 'hidden' : 'visible'}>
      <Button onclick={today}>Today</Button>
    </div>
    <Segmented options={MODES} value={mode} onchange={setMode} />
  </header>
  <div class="cal-main" {@attach swipe}>
    {#if mode === 'day'}
      <Day {date} {now} onopen={(e) => openEvent(App.findEvent(e.id))} onmore={openMore} />
    {:else if mode === '3day'}
      <ThreeDay {date} {now} onopen={(e) => openEvent(App.findEvent(e.id))} onmore={openMore} />
    {:else if mode === 'week'}
      <Week date={weekStart} {now} onopen={(e) => openEvent(App.findEvent(e.id))} onday={openDay} />
    {:else}
      <Month {date} {now} onday={openDay} />
    {/if}
  </div>
</div>

<Sheet bind:open={moreOpen}>
  <div class="cal-sheet">
    <div class="label">Overlapping</div>
    <h2 class="serif">{more?.length ?? 0} more events</h2>
    <div class="cal-more-list">
      {#each more ?? [] as e (e.id)}
        <button class="cal-more-row" style={App.pstyle(App.evColor(e))} onclick={() => pickMore(e)} {@attach pressable}>
          <i></i><b>{e.title}</b><span>{App.fmt.range(e.start, e.end)}</span>
        </button>
      {/each}
    </div>
  </div>
</Sheet>

<style>
  .cal { height: 100%; display: flex; flex-direction: column; padding-top: 14px; }
  .cal-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--tap);
    margin-bottom: 8px;
    flex: none;
  }
  .cal-title { display: flex; align-items: baseline; gap: 12px; min-width: 300px; padding: 0 6px; }
  .cal-title .serif { font-size: var(--fs-l); line-height: 1; white-space: nowrap; }
  .cal-today { margin-right: auto; }
  .cal-main { flex: 1; min-height: 0; position: relative; }

  .cal-sheet { padding: 34px 36px 32px; }
  .cal-sheet h2 { font-size: 52px; line-height: 1; margin: 6px 0 22px; }
  .cal-more-list { display: flex; flex-direction: column; gap: 8px; }
  .cal-more-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 72px;
    padding: 0 20px;
    border-radius: 14px;
    background: rgb(var(--c-rgb) / 0.12);
    text-align: left;
  }
  .cal-more-row:global(.is-pressed) { opacity: 0.7; }
  .cal-more-row i { width: 14px; height: 14px; border-radius: 50%; background: var(--c); }
  .cal-more-row b { font-size: 21px; flex: 1; }
  .cal-more-row span { font-size: 16px; color: var(--mute); }
</style>
