import { describe, expect, it, vi } from 'vitest';
import {
  StackRouter,
  SidebarRouter,
  TabRouter,
  SplitRouter,
  fitSplitWidths,
  type RouterOptions,
  type StackNavigationState,
  type NavigationAction,
} from '../src/routers';
const options: RouterOptions = {
  key: 'root',
  routes: [{ name: 'Home' }, { name: 'Post' }, { name: 'Profile' }],
};
const reduce = (s: StackNavigationState, a: NavigationAction, o = options) =>
  StackRouter.reduce(s, a, o)!;
const action = (
  type: 'navigate' | 'push' | 'replace' | 'popTo',
  name: string,
  params?: unknown,
): NavigationAction => ({ type, payload: { name, params } });
describe('StackRouter', () => {
  it('initializes the named route and rejects malformed definitions', () => {
    expect(
      StackRouter.getInitialState({ ...options, initialRouteName: 'Post' })
        .routes[0].name,
    ).toBe('Post');
    expect(() =>
      StackRouter.getInitialState({ ...options, initialRouteName: 'Unknown' }),
    ).toThrow();
    expect(() =>
      StackRouter.getInitialState({
        ...options,
        routes: [{ name: 'Home' }, { name: 'Home' }],
      }),
    ).toThrow();
  });
  it('pushes unique instances, navigates to the most recent match and updates params', () => {
    const initial = StackRouter.getInitialState(options);
    let s = reduce(initial, action('push', 'Post', { id: 1 }));
    s = reduce(s, action('push', 'Post', { id: 2 }));
    const key = s.routes[2].key;
    expect(new Set(s.routes.map((r) => r.key)).size).toBe(3);
    s = reduce(s, action('push', 'Profile'));
    s = reduce(s, action('navigate', 'Post', { id: 3 }));
    expect(s.routes).toHaveLength(3);
    expect(s.activeRouteKey).toBe(key);
    expect(s.routes[2].params).toEqual({ id: 3 });
    expect(initial.routes).toHaveLength(1);
  });
  it('replaces, pops, pops to a route and keeps the root', () => {
    let s = reduce(
      StackRouter.getInitialState(options),
      action('navigate', 'Post'),
    );
    const key = s.activeRouteKey;
    s = reduce(s, action('replace', 'Profile'));
    expect(s.routes.map((r) => r.name)).toEqual(['Home', 'Profile']);
    expect(s.activeRouteKey).not.toBe(key);
    s = reduce(s, action('push', 'Post'));
    s = reduce(s, { type: 'pop', payload: { count: 2 } });
    expect(s.routes.map((r) => r.name)).toEqual(['Home']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(reduce(s, action('popTo', 'Post'))).toBe(s);
    expect(warn).toHaveBeenCalled();
    s = reduce(s, action('push', 'Post'));
    s = reduce(s, action('popTo', 'Home', { restored: true }));
    expect(s.routes[0].params).toEqual({ restored: true });
    s = reduce(s, action('push', 'Profile'));
    expect(reduce(s, { type: 'popToRoot' }).routes).toHaveLength(1);
    expect(
      reduce(s, { type: 'pop', payload: { count: 100 } }).routes,
    ).toHaveLength(1);
    expect(reduce(s, { type: 'pop', payload: { count: -1 } })).toBe(s);
  });
  it('returns unhandled for back at root and unknown routes', () => {
    const s = StackRouter.getInitialState(options);
    expect(reduce(s, { type: 'back' })).toBeNull();
    expect(reduce(s, action('navigate', 'Unknown'))).toBeNull();
    expect(reduce(s, { type: 'forward' })).toBeNull();
    const pushed = reduce(s, action('push', 'Post'));
    expect(reduce(pushed, { type: 'back' }).routes).toEqual(s.routes);
  });
  it('preserves desktop back/forward snapshots and discards the forward branch on new navigation', () => {
    const config = { ...options, historyBehavior: 'desktop' as const };
    const initial = StackRouter.getInitialState(config);
    const post = reduce(initial, action('push', 'Post'), config);
    const profile = reduce(post, action('replace', 'Profile'), config);
    const back = reduce(profile, { type: 'back' }, config);
    expect(back.routes).toEqual(post.routes);
    expect(reduce(back, { type: 'forward' }, config).routes).toEqual(
      profile.routes,
    );
    expect(
      reduce(back, action('push', 'Home'), config).history?.future,
    ).toEqual([]);
  });
});
describe('selection routers', () => {
  const config: RouterOptions = {
    key: 'selection',
    routes: [
      { name: 'Hidden', hidden: true },
      { name: 'Disabled', disabled: true },
      { name: 'A' },
      { name: 'B' },
    ],
  };
  it('selects an eligible sidebar screen and handles collapse', () => {
    const s = SidebarRouter.getInitialState(config);
    expect(s.routes.find((r) => r.key === s.activeRouteKey)?.name).toBe('A');
    for (const name of ['Hidden', 'Disabled'])
      expect(
        SidebarRouter.reduce(s, { type: 'select', payload: { name } }, config),
      ).toBe(s);
    const next = SidebarRouter.reduce(
      s,
      { type: 'navigate', payload: { name: 'B', params: { x: 1 } } },
      config,
    )!;
    expect(
      next.routes.find((r) => r.key === next.activeRouteKey)?.params,
    ).toEqual({ x: 1 });
    expect(
      SidebarRouter.reduce(s, { type: 'toggleSidebar' }, config)?.collapsed,
    ).toBe(true);
    expect(() =>
      SidebarRouter.getInitialState({
        ...config,
        initialRouteName: 'Disabled',
      }),
    ).toThrow();
  });
  it('cycles tabs with wraparound, skipping unavailable screens', () => {
    const s = TabRouter.getInitialState(config);
    const next = TabRouter.reduce(s, { type: 'nextTab' }, config)!;
    expect(next.activeRouteKey).toBe(s.routes[3].key);
    expect(
      TabRouter.reduce(next, { type: 'nextTab' }, config)?.activeRouteKey,
    ).toBe(s.activeRouteKey);
    expect(
      TabRouter.reduce(s, { type: 'previousTab' }, config)?.activeRouteKey,
    ).toBe(next.activeRouteKey);
    expect(
      TabRouter.reduce(s, { type: 'select', payload: { name: 'B' } }, config)
        ?.activeRouteKey,
    ).toBe(next.activeRouteKey);
  });
});
describe('SplitRouter', () => {
  const config: RouterOptions = {
    key: 'split',
    routes: [
      { name: 'sidebar', minWidth: 180, maxWidth: 320 },
      { name: 'content', minWidth: 320 },
    ],
  };
  it('clamps resize and retains widths across responsive layouts', () => {
    const initial = SplitRouter.getInitialState(config);
    const resized = SplitRouter.reduce(
      initial,
      { type: 'resize', payload: { id: 'sidebar', width: 999 } },
      config,
    )!;
    expect(resized.widths.sidebar).toBe(320);
    expect(
      SplitRouter.reduce(
        initial,
        { type: 'resize', payload: { id: 'sidebar', width: 1 } },
        config,
      )?.widths.sidebar,
    ).toBe(180);
    const compact = SplitRouter.reduce(
      resized,
      { type: 'layout', payload: { ids: ['content'] } },
      config,
    )!;
    expect(compact.widths).toEqual(resized.widths);
    expect(compact.routes).toBe(initial.routes);
    expect(compact.activeRouteKey).toBe(initial.routes[1].key);
    expect(() =>
      SplitRouter.reduce(
        initial,
        { type: 'layout', payload: { ids: ['missing'] } },
        config,
      ),
    ).toThrow();
    expect(() =>
      SplitRouter.getInitialState({ ...config, routes: [config.routes[0]] }),
    ).toThrow();
  });
});
it('reduces deterministically without mutating the action or state', () => {
  const initial = StackRouter.getInitialState(options);
  const push = action('push', 'Post');
  const a = reduce(initial, push),
    b = reduce(initial, push);
  expect(a).toEqual(b);
  const back = reduce(a, { type: 'back' });
  const again = reduce(back, push);
  expect(again.activeRouteKey).not.toBe(a.activeRouteKey);
  expect(StackRouter.getInitialState(options)).toEqual(initial);
});

it('fits Split columns to a measured viewport and respects minimum and maximum widths', () => {
  const columns = [
    { name: 'left', minWidth: 180, maxWidth: 400 },
    { name: 'right', minWidth: 320, maxWidth: 800 },
  ];
  expect(fitSplitWidths(columns, { left: 240, right: 320 }, 994)).toEqual({
    left: 240,
    right: 754,
  });
  expect(fitSplitWidths(columns, { left: 400, right: 754 }, 600)).toEqual({
    left: 280,
    right: 320,
  });
  expect(fitSplitWidths(columns, { left: 240, right: 320 }, 1400)).toEqual({
    left: 400,
    right: 800,
  });
  expect(fitSplitWidths(columns, { left: 240, right: 320 }, 400)).toEqual({
    left: 180,
    right: 320,
  });
});

it('resizes only the adjacent visible Split columns and clamps against both constraints', () => {
  const config: RouterOptions = {
    key: 'split',
    routes: [
      { name: 'left', minWidth: 100, maxWidth: 500 },
      { name: 'middle', minWidth: 150, maxWidth: 350 },
      { name: 'right', minWidth: 200 },
    ],
  };
  let state = SplitRouter.getInitialState(config);
  state = SplitRouter.reduce(
    state,
    {
      type: 'layout',
      payload: {
        ids: ['left', 'middle', 'right'],
        widths: { left: 300, middle: 300, right: 400 },
      },
    },
    config,
  )!;
  const resized = SplitRouter.reduce(
    state,
    { type: 'resizeBoundary', payload: { id: 'left', width: 999 } },
    config,
  )!;
  expect(resized.widths).toEqual({ left: 450, middle: 150, right: 400 });
  expect(state.widths).toEqual({ left: 300, middle: 300, right: 400 });
  const back = SplitRouter.reduce(
    resized,
    { type: 'resizeBoundary', payload: { id: 'left', width: 0 } },
    config,
  )!;
  expect(back.widths).toEqual({ left: 250, middle: 350, right: 400 });
  const hidden = SplitRouter.reduce(
    state,
    { type: 'layout', payload: { ids: ['left', 'right'] } },
    config,
  )!;
  expect(
    SplitRouter.reduce(
      hidden,
      { type: 'resizeBoundary', payload: { id: 'left', width: 400 } },
      config,
    )!.widths,
  ).toEqual({ left: 400, middle: 300, right: 300 });
});

it('retains a collapsed middle column through responsive layouts and pins both adjacent resize boundaries', () => {
  const config = {
    key: 'root',
    routes: [
      { name: 'left', defaultWidth: 240, minWidth: 180 },
      { name: 'menu', defaultWidth: 300, minWidth: 200 },
      { name: 'right', defaultWidth: 460, minWidth: 320 },
    ],
  };
  let state = SplitRouter.getInitialState(config);
  state = SplitRouter.reduce(
    state,
    {
      type: 'layout',
      payload: {
        ids: ['left', 'menu', 'right'],
        availableWidth: 1000,
        collapsedWidths: { menu: 56 },
      },
    },
    config,
  )!;
  expect(state.widths).toEqual({ left: 240, menu: 56, right: 704 });
  for (const type of ['resize', 'resizeBoundary'] as const) {
    expect(
      SplitRouter.reduce(
        state,
        { type, payload: { id: 'menu', width: 400 } },
        config,
      ),
    ).toBe(state);
  }
  expect(
    SplitRouter.reduce(
      state,
      { type: 'resizeBoundary', payload: { id: 'left', width: 400 } },
      config,
    ),
  ).toBe(state);
  state = SplitRouter.reduce(
    state,
    { type: 'layout', payload: { ids: ['right'], availableWidth: 600 } },
    config,
  )!;
  expect(state.widths.menu).toBe(56);
  state = SplitRouter.reduce(
    state,
    {
      type: 'layout',
      payload: {
        ids: ['left', 'menu', 'right'],
        availableWidth: 1000,
        collapsedWidths: { menu: null },
      },
    },
    config,
  )!;
  expect(state.widths).toEqual({ left: 240, menu: 300, right: 460 });
});
