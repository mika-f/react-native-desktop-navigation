import {
  reduceNavigation,
  createRouteKey,
  type NavigationAction,
  type NavigationNode,
  type NavigationState,
  type RootNavigationState,
  type RouterOptions,
} from '../routers';
export type NavigationEventType = 'focus' | 'blur' | 'beforeRemove' | 'state';
export interface NavigationEvent {
  type: NavigationEventType;
  target: string;
  action?: NavigationAction;
  defaultPrevented: boolean;
  preventDefault(): void;
}
type Listener = (event: NavigationEvent) => void;
function assertSerializable(value: unknown, seen = new Set<object>()): void {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object')
    throw new Error('Navigation params must be JSON serializable.');
  if (seen.has(value))
    throw new Error('Navigation state contains a circular reference.');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error(
      'Navigation params must contain only plain objects and arrays.',
    );
  seen.add(value);
  for (const child of Object.values(value)) assertSerializable(child, seen);
  seen.delete(value);
}
export function serializeNavigationState(state: RootNavigationState): string {
  assertSerializable(state);
  return JSON.stringify(state);
}
export function restoreNavigationState(
  input: string | RootNavigationState,
): RootNavigationState {
  const state: RootNavigationState =
    typeof input === 'string'
      ? JSON.parse(input)
      : JSON.parse(serializeNavigationState(input));
  if (
    !state ||
    state.version !== 1 ||
    typeof state.rootNodeId !== 'string' ||
    !state.nodes ||
    !state.nodes[state.rootNodeId]
  )
    throw new Error('Invalid navigation snapshot (expected version 1).');
  for (const [id, node] of Object.entries(state.nodes)) {
    const s = node.state;
    if (
      id !== node.id ||
      s?.key !== id ||
      node.type !== s.type ||
      !['stack', 'sidebar', 'tabs', 'split'].includes(s.type) ||
      !Array.isArray(s.routes) ||
      !s.routes.length
    )
      throw new Error(`Invalid navigation node: ${id}`);
    const keys = s.routes.map((r) => r.key);
    if (
      new Set(keys).size !== keys.length ||
      !keys.includes(s.activeRouteKey) ||
      s.routes.some(
        (r) => typeof r.key !== 'string' || typeof r.name !== 'string',
      )
    )
      throw new Error(`Invalid routes: ${id}`);
    if (
      s.type === 'stack' &&
      (!Number.isInteger(s.nextRouteId) || s.nextRouteId < 1)
    )
      throw new Error('Invalid stack route counter.');
    if (
      (s.type === 'sidebar' || s.type === 'tabs') &&
      typeof s.collapsed !== 'boolean'
    )
      throw new Error('Invalid selection state.');
    if (
      s.type === 'stack' &&
      s.activeRouteKey !== s.routes[s.routes.length - 1].key
    )
      throw new Error('Stack active route must be the last route.');
    if (s.type === 'stack' && s.history) {
      for (const routes of [...s.history.past, ...s.history.future]) {
        if (
          !Array.isArray(routes) ||
          !routes.length ||
          routes.some(
            (r) => typeof r.key !== 'string' || typeof r.name !== 'string',
          )
        )
          throw new Error('Invalid stack history.');
      }
    }
    if (
      s.type === 'split' &&
      (!s.widths ||
        !Array.isArray(s.visibleColumnIds) ||
        !s.visibleColumnIds.length ||
        new Set(s.visibleColumnIds).size !== s.visibleColumnIds.length ||
        s.visibleColumnIds.some(
          (name) => !s.routes.some((r) => r.name === name),
        ) ||
        s.routes.some(
          (r) => !Number.isFinite(s.widths[r.name]) || s.widths[r.name] < 0,
        ))
    )
      throw new Error('Invalid split state.');
    if (s.type === 'split' && s.collapsedColumns !== undefined) {
      if (
        !s.collapsedColumns ||
        typeof s.collapsedColumns !== 'object' ||
        Array.isArray(s.collapsedColumns) ||
        Object.entries(s.collapsedColumns).some(
          ([name, column]) =>
            !s.routes.some((r) => r.name === name) ||
            !column ||
            !Number.isFinite(column.width) ||
            column.width < 0 ||
            !Number.isFinite(column.expandedWidth) ||
            column.expandedWidth < 0 ||
            s.widths[name] !== column.width,
        )
      )
        throw new Error('Invalid collapsed split state.');
    }
    const visited = new Set([id]);
    let current = node;
    while (current.parentId) {
      const parent = state.nodes[current.parentId];
      if (
        !parent ||
        visited.has(parent.id) ||
        !retainedRoutes(parent.state).some(
          (r) => r.key === current.parentRouteKey,
        )
      )
        throw new Error('Invalid navigation parent relationship.');
      visited.add(parent.id);
      current = parent;
    }
    if (current.id !== state.rootNodeId)
      throw new Error('Navigation snapshot has multiple roots.');
  }
  if (state.activeNodeId && !state.nodes[state.activeNodeId])
    throw new Error('Invalid active navigator.');
  return state;
}
function retainedRoutes(state: NavigationState) {
  return state.type === 'stack' && state.history
    ? [
        ...state.routes,
        ...state.history.past.flat(),
        ...state.history.future.flat(),
      ]
    : state.routes;
}
export class NavigationStore {
  private snapshot: RootNavigationState;
  private subscribers = new Set<() => void>();
  private events = new Map<string, Map<NavigationEventType, Set<Listener>>>();
  private configs = new Map<string, RouterOptions>();
  private mounted = new Set<string>();
  constructor(initialState?: RootNavigationState) {
    this.snapshot = initialState
      ? restoreNavigationState(initialState)
      : { version: 1, rootNodeId: 'root', nodes: {} };
  }
  getState = () => this.snapshot;
  getNode = (id: string): NavigationNode | undefined => this.snapshot.nodes[id];
  subscribe = (listener: () => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };
  isReady = () => this.mounted.has(this.snapshot.rootNodeId);
  register(node: NavigationNode, options: RouterOptions) {
    assertSerializable(node.state);
    if (this.mounted.has(node.id))
      throw new Error(
        `Duplicate navigator id: ${node.id}. Supply a unique id for sibling navigators.`,
      );
    const saved = this.snapshot.nodes[node.id];
    if (
      saved &&
      (saved.type !== node.type ||
        retainedRoutes(saved.state).some(
          (r) => !options.routes.some((c) => c.name === r.name),
        ))
    )
      throw new Error(`Saved state does not match navigator ${node.id}.`);
    const previousFocus = this.focusedRouteKeys();
    this.configs.set(node.id, options);
    this.mounted.add(node.id);
    this.commit(
      {
        ...this.snapshot,
        rootNodeId: node.parentId ? this.snapshot.rootNodeId : node.id,
        nodes: { ...this.snapshot.nodes, [node.id]: saved ?? node },
      },
      undefined,
      previousFocus,
    );
    return () => {
      const oldFocus = this.focusedRouteKeys();
      this.mounted.delete(node.id);
      this.configs.delete(node.id);
      this.publishFocus(oldFocus);
      for (const listener of this.subscribers) listener();
    };
  }
  updateOptions(id: string, options: RouterOptions) {
    this.configs.set(id, options);
  }
  addListener(routeKey: string, type: NavigationEventType, listener: Listener) {
    let types = this.events.get(routeKey);
    if (!types) this.events.set(routeKey, (types = new Map()));
    let listeners = types.get(type);
    if (!listeners) types.set(type, (listeners = new Set()));
    listeners.add(listener);
    return () => {
      listeners!.delete(listener);
      if (!listeners!.size) types!.delete(type);
      if (!types!.size) this.events.delete(routeKey);
    };
  }
  private emit(
    target: string,
    type: NavigationEventType,
    action?: NavigationAction,
  ) {
    const event: NavigationEvent = {
      type,
      target,
      action,
      defaultPrevented: false,
      preventDefault() {
        if (type === 'beforeRemove') this.defaultPrevented = true;
      },
    };
    for (const listener of this.events.get(target)?.get(type) ?? [])
      listener(event);
    return event.defaultPrevented;
  }
  isNodeFocused(id: string): boolean {
    const node = this.snapshot.nodes[id];
    if (!node || !this.mounted.has(id)) return false;
    if (!node.parentId) return true;
    const parent = this.snapshot.nodes[node.parentId];
    return (
      !!parent &&
      parent.state.activeRouteKey === node.parentRouteKey &&
      this.isNodeFocused(parent.id)
    );
  }
  isRouteFocused(id: string, routeKey: string) {
    return (
      this.getNode(id)?.state.activeRouteKey === routeKey &&
      this.isNodeFocused(id)
    );
  }
  private focusedRouteKeys() {
    const depth = (node: NavigationNode): number =>
      node.parentId && this.getNode(node.parentId)
        ? 1 + depth(this.getNode(node.parentId)!)
        : 0;
    return Object.values(this.snapshot.nodes)
      .filter((n) => this.isNodeFocused(n.id))
      .sort((a, b) => depth(a) - depth(b))
      .map((n) => n.state.activeRouteKey);
  }
  private publishFocus(previous: string[]) {
    const next = this.focusedRouteKeys();
    for (const key of [...previous].reverse())
      if (!next.includes(key)) this.emit(key, 'blur');
    for (const key of next)
      if (!previous.includes(key)) this.emit(key, 'focus');
  }
  private commit(
    next: RootNavigationState,
    action?: NavigationAction,
    previous = this.focusedRouteKeys(),
  ) {
    this.snapshot = next;
    this.publishFocus(previous);
    for (const listener of this.subscribers) listener();
    for (const node of Object.values(next.nodes))
      for (const route of node.state.routes)
        this.emit(route.key, 'state', action);
  }
  focusRoute(id: string, routeKey: string) {
    const node = this.getNode(id);
    if (
      node?.state.type === 'split' &&
      node.state.activeRouteKey !== routeKey
    ) {
      const route = node.state.routes.find((r) => r.key === routeKey);
      if (!route || !node.state.visibleColumnIds.includes(route.name)) return;
      this.commit({
        ...this.snapshot,
        nodes: {
          ...this.snapshot.nodes,
          [id]: { ...node, state: { ...node.state, activeRouteKey: routeKey } },
        },
      });
    }
    // Native focus bubbles: an ancestor Scene must not replace the focused leaf.
    let active = this.getNode(this.getActiveNodeId());
    while (active) {
      if (active.id === id && this.isNodeFocused(this.getActiveNodeId()))
        return;
      active = active.parentId ? this.getNode(active.parentId) : undefined;
    }
    this.setFocusedNode(id);
  }
  setFocusedNode(id: string) {
    if (!this.mounted.has(id)) return;
    let node = this.getNode(id);
    const nodes = { ...this.snapshot.nodes };
    while (node?.parentId) {
      const parent = nodes[node.parentId];
      if (!parent) return;
      if (parent.state.type === 'split') {
        const route = parent.state.routes.find(
          (r) => r.key === node!.parentRouteKey,
        );
        if (!route || !parent.state.visibleColumnIds.includes(route.name))
          return;
        nodes[parent.id] = {
          ...parent,
          state: { ...parent.state, activeRouteKey: route.key },
        };
      } else if (parent.state.activeRouteKey !== node.parentRouteKey) return;
      node = parent;
    }
    if (
      this.snapshot.activeNodeId === id &&
      Object.keys(nodes).every((key) => nodes[key] === this.snapshot.nodes[key])
    )
      return;
    this.commit({ ...this.snapshot, nodes, activeNodeId: id });
  }
  getActiveNodeId() {
    const preferred = this.snapshot.activeNodeId;
    let id =
      preferred && this.isNodeFocused(preferred)
        ? preferred
        : this.snapshot.rootNodeId;
    while (true) {
      const child = Object.values(this.snapshot.nodes).find(
        (n) => n.parentId === id && this.isNodeFocused(n.id),
      );
      if (!child) return id;
      id = child.id;
    }
  }
  canDispatch(
    type: 'back' | 'forward',
    target = this.getActiveNodeId(),
  ): boolean {
    let node = this.getNode(target);
    while (node) {
      const s = node.state;
      if (
        s.type === 'stack' &&
        (type === 'back'
          ? s.history
            ? s.history.past.length > 0
            : s.routes.length > 1
          : !!s.history?.future.length)
      )
        return true;
      node = node.parentId ? this.getNode(node.parentId) : undefined;
    }
    return false;
  }
  dispatch = (original: NavigationAction): boolean => {
    let action = original;
    if ('payload' in action) assertSerializable(action.payload);
    if (
      action.type === 'navigate' ||
      action.type === 'push' ||
      action.type === 'replace'
    )
      action = {
        ...action,
        payload: {
          ...action.payload,
          key: action.payload.key ?? createRouteKey(action.payload.name),
        },
      };
    let node = this.getNode(action.target ?? this.getActiveNodeId());
    while (node) {
      const options = this.configs.get(node.id);
      const next = options
        ? reduceNavigation(node.state, action, options)
        : null;
      if (next) {
        if (next === node.state) return true;
        const removed = node.state.routes
          .filter((r) => !next.routes.some((n) => n.key === r.key))
          .map((r) => r.key);
        const removedNodes = new Set<string>();
        let changed = true;
        while (changed) {
          changed = false;
          for (const child of Object.values(this.snapshot.nodes))
            if (
              !removedNodes.has(child.id) &&
              ((child.parentId === node.id &&
                removed.includes(child.parentRouteKey!)) ||
                removedNodes.has(child.parentId!))
            ) {
              removedNodes.add(child.id);
              removed.push(...child.state.routes.map((r) => r.key));
              changed = true;
            }
        }
        let blocked = false;
        for (const key of [...removed].reverse())
          blocked = this.emit(key, 'beforeRemove', action) || blocked;
        if (blocked) return true;
        const nodes = {
          ...this.snapshot.nodes,
          [node.id]: { ...node, state: next },
        };
        // Keep history-owned subtrees so Back/Forward can restore nested navigator state.
        let pruned = true;
        while (pruned) {
          pruned = false;
          for (const child of Object.values(nodes))
            if (
              child.parentId &&
              (!nodes[child.parentId] ||
                !retainedRoutes(nodes[child.parentId].state).some(
                  (r) => r.key === child.parentRouteKey,
                ))
            ) {
              delete nodes[child.id];
              pruned = true;
            }
        }
        this.commit({ ...this.snapshot, nodes, activeNodeId: node.id }, action);
        return true;
      }
      node = node.parentId ? this.getNode(node.parentId) : undefined;
    }
    if (
      ['navigate', 'push', 'replace', 'popTo', 'select'].includes(action.type)
    )
      console.warn(
        `Unhandled navigation action: ${action.type}${'payload' in action && action.payload && 'name' in action.payload ? ` (${action.payload.name})` : ''}`,
      );
    return false;
  };
}
