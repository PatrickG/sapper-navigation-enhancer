# sapper-navigation-enhancer

## Important
* You need to use the [`goto`](#goto) function exported by sapper-navigation-enhancer instead of the `goto` function exported by Sapper.
* You need to use the [`redirect`](#redirect) function exported by sapper-navigation-enhancer instead of Sappers `this.redirect` in your `preload` functions.


## Install

```sh
npm install sapper-navigation-enhancer
```


## Initialization

`src/client.js`
```js
import { start } from '@sapper/app';
import beforeStart from 'sapper-navigation-enhancer';

const afterStart = beforeStart(['/'], true);
start({ target: document.querySelector('#app') });
afterStart();
```

`src/routes/_layout.svelte`
```html
<script>
  import { goto, stores } from '@sapper/app';
  import { init } from 'sapper-navigation-enhancer';

  const { page } = stores();

  init(page, goto);
</script>
```


## API

### back

```ts
function back(fallback: string | () => string): void;
```

If [`canGoBack()`](#cangoback) returns `true`, navigates to the previous history entry (like `history.back()`).\
If [`canGoBack()`](#cangoback) returns `false`, navigates to the `fallback` url. It will do so by prepending a history entry with the fallback url before the current history entry and then navigates back.


### beforeNavigate

```ts
type Callback = (href: string) => false | Promise<false | any> | any;
type Unsubscribe = () => void;
function beforeNavigate(callback: Callback, useBeforeUnload: boolean = false): Unsubscribe;
```

Subscribe to navigation attempts. Navigation will be prevented, when you return `false` or `Promise<false>`.

If `useBeforeUnload` (or `alwaysUseBeforeUnload` in [`beforeStart`](#beforestart)) is `true`, a `onbeforeunload` listener will be created.\
Returns an `Unsubscribe` function, which must be called when the component is destroyed.

```html
<!-- some-route-or-component.svelte -->
<script>
  import { beforeNavigate } from 'sapper-navigation-enhancer';
  import { onMount } from 'svelte';

  onMount(() => beforeNavigate(href => confirm(`Do you want to navigate to ${href}?`)));
</script>
```


### beforeStart

```ts
type AfterStart = () => void;
function beforeStart(startPaths?: string[], alwaysUseBeforeUnload: boolean = false): AfterStart;
```

You need to call this function before you call Sappers `start` function and you need to call the returned `AfterStart` function after you call Sappers `start` function. Typically in the `client.js`.

If you provide the `startPaths` parameter and the current `location.pathname` does not match any of them, it will prepend a history entry - with the first item of `startPaths` array as the url - before the current history entry.\
If `alwaysUseBeforeUnload` is `true`, a `onbeforeunload` listener will be created when calling [`beforeNavigate`](#beforenavigate) or [`preventNavigation`](#preventnavigation).

This is the default exported function also, see [Initialization](#initialization).


### canGoBack

```ts
function canGoBack(): boolean;
```

Returns true if the previous history entry is from your app.

At the same time, `canGoBack` is a readable store.

```html
<!-- some-component.svelte -->
<script>
  import { back, canGoBack } from 'sapper-navigation-enhancer';
</script>

{#if $canGoBack}
  <button on:click={() => back('/')}>Go back</button>
{/if}
```


### goto

```ts
function goto(href: string, opts?: { force?: boolean; noscroll?: boolean; replaceStart?: boolean; }): Promise<void>;
```

You need to use this function instead of Sappers `goto` function.

If `opts.force` is `true`, no [`beforeNavigate`](#beforenavigate) callback will be called.\
If you called [`preventNavigation`](#preventnavigation), `opts.force` has no effect.

```diff
<!-- some-component.svelte -->
<script>
-  import { goto } from '@sapper/app';
+  import { goto } from 'sapper-navigation-enhancer';
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

You need to call this in your root layout component, see [Initialization](#initialization).


### preventNavigation

```ts
type RemovePrevention = () => void;
function preventNavigation(useBeforeUnload: boolean = false): RemovePrevention;
```

Prevents navigation. Returns a function that stops the prevention when called.

If `useBeforeUnload` (or `alwaysUseBeforeUnload` in [`beforeStart`](#beforestart)) is `true`, a `onbeforeunload` listener will be created.

```html
<!-- some-component.svelte -->
<script>
  import { preventNavigation } from 'sapper-navigation-enhancer';

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

You need to use this function instead of Sappers `this.redirect()` inside your `preload` functions.

```diff
<!-- some-route-or-layout.svelte -->
<script context="module">
+  import { redirect } from 'sapper-navigation-enhancer';

  export function preload() {
-    this.redirect(302, '/');
+    redirect(this, 302, '/');
  }
</script>
```
