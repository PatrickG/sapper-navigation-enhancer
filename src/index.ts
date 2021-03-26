import type { PageContext, PreloadContext } from '@sapper/common';
import type { Readable } from 'svelte/store';
import { writable } from 'svelte/store';

type Goto = typeof import('@sapper/app').goto;

type beforeNavigateCallback = (
  url: string
) => false | Promise<false | any> | any;

const browser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof location !== 'undefined' &&
  typeof history !== 'undefined';

const canGoBackStore = writable(false);

let started = false;
let initialized = false;

let current = 0;
let next: Record<string, any> | undefined;
let chillOnPop = false;

let clickListener = false;
let beforeUnloadListener = false;
let preventions: boolean[][] = [];
let beforeNavigateCallbacks: [beforeNavigateCallback, boolean][] = [];

let sapperGoto: Goto;
let startPaths: string[] | undefined;
let alwaysUseBeforeUnload = false;

const prepend = (path: string, state?: any) => {
  const { href } = location;
  const { title } = document;
  history.replaceState({ i: 0 }, '', path);
  history.pushState({ ...state, i: 1 }, title, href);
};

const clickHandler = (event: MouseEvent) => {
  if (
    event.button ||
    event.which !== 1 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const anchor = (event.target as Element).closest('a') as
    | HTMLAnchorElement
    | SVGAElement;
  if (!anchor || !anchor.href || anchor.hasAttribute('download')) {
    return;
  }

  const href =
    typeof anchor.href === 'object' &&
    anchor.href.constructor.name === 'SVGAnimatedString'
      ? anchor.href.baseVal
      : (anchor.href as string);

  event.preventDefault();
  if (!preventions.length && href !== location.href) {
    notifyBeforeNavigate({ href });
  }
};

const addClickListener = () => {
  if (!clickListener) {
    clickListener = true;
    window.addEventListener('click', clickHandler, true);
  }
};

const removeClickListener = () => {
  if (clickListener && !preventions.length && !beforeNavigateCallbacks.length) {
    clickListener = false;
    window.removeEventListener('click', clickHandler, true);
  }
};

const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  return (event.returnValue = 'Navigation prevented');
};

const addBeforeUnloadListener = () => {
  if (!beforeUnloadListener) {
    beforeUnloadListener = true;
    window.addEventListener('beforeunload', beforeUnloadHandler, true);
  }
};

const removeBeforeUnloadListener = () => {
  if (
    beforeUnloadListener &&
    !preventions.some(([beforeUnload]) => beforeUnload) &&
    !beforeNavigateCallbacks.some(([_, beforeUnload]) => beforeUnload)
  ) {
    beforeUnloadListener = false;
    window.removeEventListener('beforeunload', beforeUnloadHandler, true);
  }
};

const waitUntilAtCurrent = () =>
  new Promise(resolve => {
    const done = () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
      (resolve as () => void)();
    };

    const check = () => {
      animationFrame = requestAnimationFrame(check);
      if (history.state?.i === current) {
        done();
      }
    };

    let animationFrame = requestAnimationFrame(check);
    const timeout = setTimeout(done, 300);
  });

const notifyBeforeNavigate = async (
  { href, delta }: { href: string; delta?: number },
  opts?: { noscroll?: boolean; replaceState?: boolean }
) => {
  if (
    !(
      await Promise.all(
        beforeNavigateCallbacks.map(([callback]) => callback(href))
      )
    ).some(result => result === false)
  ) {
    if (delta) {
      chillOnPop = true;
      history.go(-delta);
    } else {
      goto(href, { ...opts, force: true });
    }
  }
};

export const beforeStart = (
  _startPaths?: string[],
  _alwaysUseBeforeUnload: boolean = false
) => {
  if (started) {
    throw new Error('Already started');
  }

  started = true;
  startPaths = _startPaths;
  alwaysUseBeforeUnload = _alwaysUseBeforeUnload;

  window.addEventListener('popstate', event => {
    const { i } = event.state || {};
    if (i || i === 0) {
      const hasPreventions = preventions.length;
      if (hasPreventions || (!chillOnPop && beforeNavigateCallbacks.length)) {
        event.stopImmediatePropagation();
        const delta = current - i;
        if (delta !== 0) {
          const { href } = location;
          history.go(delta);
          if (!hasPreventions) {
            waitUntilAtCurrent().then(() =>
              notifyBeforeNavigate({ href, delta })
            );
          }
        }
      } else {
        next = { i: current = i };
        canGoBackStore.set(current > 0);
      }
    }

    chillOnPop = false;
  });

  let { state } = history;
  if (state?.i || state?.i === 0) {
    current = state.i;
    canGoBackStore.set(current > 0);
  } else if (
    startPaths &&
    startPaths[0] &&
    !startPaths.includes(location.pathname)
  ) {
    prepend(startPaths[0]);
    state = { ...state, i: ++current };
    canGoBackStore.set(true);
  } else {
    state = { ...state, i: 0 };
  }

  // returns `afterStart()`
  return () =>
    setTimeout(
      () => history.replaceState(state, document.title, location.href),
      0
    );
};

export default beforeStart;

export const init = (page: Readable<PageContext>, goto: Goto) => {
  sapperGoto = goto;

  if (browser) {
    if (initialized) {
      throw new Error('Already initialized');
    }

    initialized = true;

    page.subscribe(() => {
      const { state } = history;
      if (state?.i || state?.i === 0) {
        current = state.i;
      } else {
        history.replaceState(
          {
            ...state,
            ...next,
            i: current = next?.i || next?.i === 0 ? next.i : current + 1,
          },
          document.title,
          location.href
        );
      }

      next = undefined;
      canGoBackStore.set(current > 0);
    });
  }
};

export const preventNavigation = (useBeforeUnload: boolean = false) => {
  const beforeUnload = alwaysUseBeforeUnload || useBeforeUnload;
  const prevention = [beforeUnload];

  preventions.push(prevention);

  addClickListener();
  if (beforeUnload) {
    addBeforeUnloadListener();
  }

  return () => {
    const index = preventions.indexOf(prevention);
    if (index !== 1) {
      preventions.splice(index, 1);
      removeClickListener();
      removeBeforeUnloadListener();
    }
  };
};

export const beforeNavigate = (
  callback: beforeNavigateCallback,
  useBeforeUnload: boolean = false
) => {
  const beforeUnload = alwaysUseBeforeUnload || useBeforeUnload;
  const beforeNavigateCallback = beforeNavigateCallbacks.find(
    ([cb]) => cb === callback
  );

  if (!beforeNavigateCallback) {
    beforeNavigateCallbacks.push([callback, beforeUnload]);
  } else if (beforeNavigateCallback[1] !== beforeUnload) {
    beforeNavigateCallback[1] = beforeUnload;
  }

  addClickListener();
  if (beforeUnload) {
    addBeforeUnloadListener();
  }

  return () => {
    const index = beforeNavigateCallbacks.findIndex(([cb]) => cb === callback);
    if (index !== -1) {
      beforeNavigateCallbacks.splice(index, 1);
      removeClickListener();
      removeBeforeUnloadListener();
    }
  };
};

export const canGoBack = () => current > 0;
canGoBack.subscribe = canGoBackStore.subscribe;

export const back = (fallback?: string | (() => string)) => {
  if (preventions.length) {
    return;
  }

  if (!canGoBack()) {
    if (typeof fallback === 'function') {
      fallback = fallback();
    }

    if (typeof fallback !== 'string') {
      if (startPaths && startPaths[0]) {
        fallback = startPaths[0];
      } else {
        throw new Error('Could not go back');
      }
    }

    prepend(fallback, history.state);
  }

  setTimeout(() => history.back(), 0);
};

export const redirect = (
  preloadContext: PreloadContext,
  statusCode: number,
  path: string
) => {
  if (browser) {
    next = { ...next, i: next?.i || next?.i === 0 ? next.i : history.state?.i };
  }

  return preloadContext.redirect(statusCode, path);
};

export const goto = async (
  href: string,
  opts: {
    force?: boolean;
    noscroll?: boolean;
    replaceState?: boolean;
    state?: Record<string, any>;
  } = {}
) => {
  if (preventions.length) {
    return;
  }

  if (!opts?.force && beforeNavigateCallbacks.length) {
    notifyBeforeNavigate({ href }, opts);
    return;
  }

  if (!sapperGoto) {
    throw new Error('Not initialized');
  }

  if (opts?.replaceState) {
    next = { ...opts.state, i: history.state?.i };
  } else if (opts.state) {
    next = opts.state;
  }

  return sapperGoto(href, opts);
};

export const state = (state: Record<string, any>) =>
  history.replaceState(
    { ...history.state, ...state, i: current },
    document.title,
    location.href
  );
