import { expect, it, vi } from 'vitest';
import {
  NavigationStore,
  restoreNavigationState,
  serializeNavigationState,
} from '../src/core/store';
import { StackRouter, SidebarRouter, type RouterOptions } from '../src/routers';
const options: RouterOptions = {
  key: 'root',
  routes: [{ name: 'Main' }, { name: 'About' }],
};
function setup() {
  const store = new NavigationStore();
  const root = StackRouter.getInitialState(options);
  store.register({ id: 'root', type: 'stack', state: root }, options);
  const childOptions = {
    key: 'child',
    routes: [{ name: 'Timeline' }, { name: 'Settings' }],
  };
  const child = SidebarRouter.getInitialState(childOptions);
  store.register(
    {
      id: 'child',
      parentId: 'root',
      parentRouteKey: root.activeRouteKey,
      type: 'sidebar',
      state: child,
    },
    childOptions,
  );
  return { store, root, child };
}
it('bubbles unknown actions from child to parent, and emits blur before focus', () => {
  const { store, root, child } = setup();
  const events: string[] = [];
  store.addListener(child.activeRouteKey, 'blur', () =>
    events.push('child blur'),
  );
  store.addListener(root.activeRouteKey, 'blur', () =>
    events.push('root blur'),
  );
  store.dispatch({
    type: 'navigate',
    target: 'child',
    payload: { name: 'About' },
  });
  const about = store.getNode('root')!.state.activeRouteKey;
  store.addListener(about, 'blur', () => events.push('about blur'));
  store.addListener(root.activeRouteKey, 'focus', () =>
    events.push('root focus'),
  );
  store.addListener(child.activeRouteKey, 'focus', () =>
    events.push('child focus'),
  );
  store.dispatch({ type: 'back' });
  expect(events).toEqual([
    'child blur',
    'root blur',
    'about blur',
    'root focus',
    'child focus',
  ]);
});
it('blocks removal atomically including descendants and unsubscribes guards', () => {
  const { store, child } = setup();
  const snapshot = store.getState();
  const unsubscribe = store.addListener(
    child.activeRouteKey,
    'beforeRemove',
    (e) => e.preventDefault(),
  );
  store.dispatch({
    type: 'replace',
    target: 'root',
    payload: { name: 'About' },
  });
  expect(store.getState()).toBe(snapshot);
  unsubscribe();
  store.dispatch({
    type: 'replace',
    target: 'root',
    payload: { name: 'About' },
  });
  expect(store.getNode('root')!.state.routes[0].name).toBe('About');
  expect(store.getNode('child')).toBeUndefined();
});
it('serializes and restores a nested tree without React or platform imports', () => {
  const { store } = setup();
  store.dispatch({
    type: 'navigate',
    target: 'child',
    payload: { name: 'Settings', params: { tab: 'general' } },
  });
  const json = serializeNavigationState(store.getState());
  const restored = new NavigationStore(restoreNavigationState(json));
  expect(serializeNavigationState(restored.getState())).toBe(json);
  expect(() => restoreNavigationState('{"version":2}')).toThrow();
  const malformed = JSON.parse(json);
  malformed.nodes.child.parentId = 'child';
  expect(() => restoreNavigationState(malformed)).toThrow();
  expect(() =>
    store.dispatch({
      type: 'navigate',
      payload: { name: 'About', params: { fn() {} } },
    }),
  ).toThrow(/serializable/);
});
it('does not mutate snapshots and notifies subscribers after state updates', () => {
  const { store } = setup();
  const previous = store.getState();
  const listener = vi.fn(() => expect(store.getState()).not.toBe(previous));
  const unsubscribe = store.subscribe(listener);
  store.dispatch({ type: 'navigate', payload: { name: 'About' } });
  expect(listener).toHaveBeenCalledOnce();
  expect(previous.nodes.root.state.routes).toHaveLength(1);
  unsubscribe();
  store.dispatch({ type: 'back' });
  expect(listener).toHaveBeenCalledOnce();
});

it('rejects invalid collapsed column snapshots while accepting snapshots without collapse metadata', () => {
  const base = {
    version: 1,
    rootNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'split',
        state: {
          type: 'split',
          key: 'root',
          activeRouteKey: 'menu',
          routes: [
            { key: 'menu', name: 'menu' },
            { key: 'content', name: 'content' },
          ],
          visibleColumnIds: ['menu', 'content'],
          widths: { menu: 56, content: 744 },
        },
      },
    },
  };
  expect(() => restoreNavigationState(JSON.stringify(base))).not.toThrow();
  for (const collapsedColumns of [
    { menu: { width: 56, expandedWidth: -1 } },
    { menu: { width: 100, expandedWidth: 240 } },
    { unknown: { width: 56, expandedWidth: 240 } },
    [],
    null,
  ]) {
    const snapshot = JSON.parse(JSON.stringify(base));
    snapshot.nodes.root.state.collapsedColumns = collapsedColumns;
    expect(() => restoreNavigationState(snapshot)).toThrow(/collapsed split/);
  }
});
