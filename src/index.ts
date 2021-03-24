import type { PageContext, PreloadContext } from '@sapper/common';
import type { Readable } from 'svelte/store';

type Goto = typeof import('@sapper/app').goto;

type beforeNavigateCallback = (
  url: string
) => boolean | undefined | void | Promise<boolean | undefined | void>;

const browser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof location !== 'undefined' &&
  typeof history !== 'undefined';

let started = false;
let initialized = false;

let popI: number | undefined;
let current = 0;
let prevent = false;
let clickListener = false;
let forceGoto = false;
let beforeNavigateCallbacks: beforeNavigateCallback[] = [];

let startPaths: string[] | undefined;
let sapperGoto: Goto;

const prepend = (path: string, state?: any) => {
  const { href } = location;
  const { title } = document;
  history.replaceState({ i: 0 }, '', path);
  history.pushState({ ...state, i: 1 }, title, href);
};

const clickHandler = (event: MouseEvent) => {
  if ((event.which === null ? event.button : event.which) !== 1) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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
  if (!prevent && href !== location.href) {
    notifyBeforeNavigate(href);
  }
};

const addClickListener = () => {
  if (!clickListener) {
    clickListener = true;
    window.addEventListener('click', clickHandler, true);
  }
};

const removeClickListener = () => {
  if (clickListener && !prevent && !beforeNavigateCallbacks.length) {
    clickListener = false;
    window.removeEventListener('click', clickHandler, true);
  }
};

const notifyBeforeNavigate: Goto = async (href: string, opts) => {
  if (
    !(
      await Promise.all(beforeNavigateCallbacks.map(callback => callback(href)))
    ).some(result => result === false)
  ) {
    forceGoto = true;
    goto(href, opts);
    forceGoto = false;
  }
};

export const beforeStart = (_startPaths?: string[]) => {
  if (started) {
    throw new Error('Already started');
  }

  started = true;
  startPaths = _startPaths;

  window.addEventListener('popstate', event => {
    const { i } = event.state || {};
    if (i || i === 0) {
      if (prevent || beforeNavigateCallbacks.length) {
        event.stopImmediatePropagation();
        const delta = current - i;
        if (delta !== 0) {
          const { href } = location;
          history.go(delta);
          if (!prevent) {
            notifyBeforeNavigate(href);
          }
        }
      } else {
        popI = current = i;
      }
    }
  });

  let { state } = history;
  if (state?.i || state?.i === 0) {
    current = state.i;
  } else if (
    startPaths &&
    startPaths[0] &&
    !startPaths.includes(location.pathname)
  ) {
    prepend(startPaths[0]);
    state = { ...state, i: ++current };
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
          { ...state, i: (current = popI || popI === 0 ? popI : current + 1) },
          document.title,
          location.href
        );
      }

      popI = undefined;
    });
  }
};

export const preventNavigation = () => {
  prevent = true;
  addClickListener();

  return () => {
    prevent = false;
    removeClickListener();
  };
};

export const beforeNavigate = (callback: beforeNavigateCallback) => {
  if (!beforeNavigateCallbacks.includes(callback)) {
    beforeNavigateCallbacks.push(callback);
    addClickListener();
  }

  return () => {
    const index = beforeNavigateCallbacks.indexOf(callback);
    if (index !== -1) {
      beforeNavigateCallbacks.splice(index, 1);
      removeClickListener();
    }
  };
};

export const canGoBack = () => current > 0;

export const back = (fallback?: string | (() => string)) => {
  if (prevent) {
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
  if (!browser) {
    return preloadContext.redirect(statusCode, path);
  }

  const { state } = history;
  preloadContext.redirect(statusCode, path);
  if (state?.i || state?.i === 0) {
    setTimeout(
      () =>
        history.replaceState(
          { ...history.state, i: state.i },
          document.title,
          location.href
        ),
      0
    );
  }
};

export const enhancePreloadContext = (preloadContext: PreloadContext) => {
  if (!browser) {
    return;
  }

  const { redirect } = preloadContext;
  preloadContext.redirect = (statusCode: number, path: string) => {
    const { state } = history;
    redirect.call(preloadContext, statusCode, path);
    if (state?.i || state?.i === 0) {
      setTimeout(() => {
        history.replaceState(
          { ...history.state, i: state.i },
          document.title,
          location.href
        );
      }, 0);
    }
  };
};

export const goto: Goto = async (href, opts) => {
  if (!forceGoto && (prevent || beforeNavigateCallbacks.length)) {
    notifyBeforeNavigate(href, opts);
    return;
  }

  if (!sapperGoto) {
    throw new Error('Not initialized');
  }

  if (!browser || !opts?.replaceState) {
    return sapperGoto(href, opts);
  }

  const { state } = history;
  const result = await sapperGoto(href, opts);
  if (state?.i || state?.i === 0) {
    current = state.i;
    history.replaceState(
      { ...history.state, i: current },
      document.title,
      location.href
    );
  }

  return result;
};
