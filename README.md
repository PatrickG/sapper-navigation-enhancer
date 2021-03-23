# **SNE** **S**apper**N**avigation**E**nhancer

## Important
* You need to use the `goto` function exported by **S**apper**N**avigation**E**nhancer instead of the `goto` function exported by Sapper.
* You need to use either the `redirect` or `enhancePreloadContext` function instead of Sappers `this.redirect` in your `preload` functions.


## Initialization

`src/client.js`
```js
import { start } from '@sapper/app';
import beforeStart from 'sne';

const afterStart = beforeStart(['/']);
start({ target: document.querySelector('#app') });
afterStart();
```

`src/routes/_layout.svelte`
```html
<script>
  import { goto, stores } from '@sapper/app';
  import { init } from 'sne';

  const { page } = stores();

  init(page, goto);
</script>
```


## API

### back

```ts
function back(fallback: string | () => string): void;
```

If `canGoBack()` returns `true`, navigates to the previous history entry (like `history.back()`).\
If `canGoBack()` returns `false`, navigates to the `fallback` url. It will do so by prepending a history entry with the fallback url before the current history entry and then navigates back.


### beforeNavigate

```ts
type Callback = (href: string) => boolean | undefined | void | Promise<boolean | undefined | void>;
type Unsubscribe = () => void;
function beforeNavigate(Callback): Unsubscribe;
```

Subscribe to navigation attempts. Navigation will be prevented, when you return `false` or `Promise<false>`.

```html
<!-- some-route-or-component.svelte -->
<script>
  import { beforeNavigate } from 'sne';
  import { onMount } from 'svelte';

  onMount(() => beforeNavigate(href => confirm(`Do you want to navigate to ${href}?`)));
</script>
```


### beforeStart

```ts
type AfterStart = () => void;
function beforeStart(startPaths?: string[]): AfterStart;
```

You need to call this function before you call Sappers `start` function and you need to call the returned `AfterStart` function after you call Sappers `start` function. Typically in the `client.js`.

If you provide the `startPaths` parameter and the current `location.pathname` does not match any of them, it will prepend a history entry - with the first item of `startPaths` array as the url - before the current history entry.

This is the default exported function also, see Initialization.


### canGoBack

```ts
function canGoack(): boolean;
```

Returns true if the previous history entry is from your app.


### enhancePreloadContext

```ts
import type { PreloadContext } from '@sapper/app';
function enhancePreloadContext(preloadContext: PreloadContext): void;
```

Enhance sappers preload context with **S**apper**N**avigation**E**nhancers redirect function.

```html
<!-- src/routes/_layout.svelte -->
<script context="module">
  import { enhancePreloadContext } from 'sne';

  export function preload() {
    enhancePreloadContext(this);
  };
</script>
```

```html
<!-- some-layout-or-route.svelte -->
<script context="module">
  export function preload() {
    this.redirect(302, '/');
  }
</script>
```


### goto

```ts
function goto(href: string, opts?: { noscroll?: boolean; replaceStart?: boolean; }): Promise<void>;
```

You need to use this function instead of Sappers `goto` function.

```diff
<!-- some-component.svelte -->
<script>
-  import { goto } from '@sapper/app';
+  import { goto } from 'sne';
</script>

<button on:click={() => goto('/')}>Home</button>
```


### init

```ts
import type { PageContext } from '@sapper/common';
import type { Readable } from 'svelte/store';
type Goto = typeof import('@sapper/app').goto;
function init(page: Readable<PageContext>, goto: Goto): void;
```

You need to call this in your root layout component, see Initialization.


### preventNavigation

```ts
type RemovePrevention = () => void;
function preventNavigation(): RemovePrevention;
```

Prevents navigation. Returns a function that stops the prevention when called.

```html
<!-- some-component.svelte -->
<script>
  import { preventNavigation } from 'sne';

  let preventing;
  function togglePrevention() {
    if (preventing) {
      preventing();
      preventing = null;
    } else {
      preventing = preventNavigation();
    }
  }
</script>

<button on:click={togglePrevention}>Toggle navigation prevention</button>
```


### redirect

```ts
import type { PreloadContext } from '@sapper/common';
function redirect(preloadContext: PreloadContext, statusCode: number, location: string): void;
```

You need to use this function (or `enhancePreloadContext`) instead of Sappers `this.redirect()` inside your `preload` functions.

```diff
<!-- some-route-or-layout.svelte -->
<script context="module">
+  import { redirect } from 'sne';

  export function preload() {
-    this.redirect(302, '/');
+    redirect(this, 302, '/');
  }
</script>
```
