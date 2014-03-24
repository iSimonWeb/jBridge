jBridge
=======

> jBridge, the missing piece. An easy, abstract and versatile AJAX + History API site manager.

Demos
======
+ [Official site, getjBridge.com](http://getjbridge.com/)
+ [First site developed with jBridge](http://www.lafarfallaeilgirasole.it/)

Just few words first.
-------

**AJAX** is the key to a *flawless* site navigation.
I’ve always *hated* the moment when the browser blanks the viewport to replace the old content with the next page from the same site. Website navigation is like walking, you *don’t just teleport yourself* from place to place: step by step, you **reach it**.

This idea has been known for years, many tried to make it simple: [jQuery Address](http://www.asual.com/jquery/address/), [jQuery-pajax](https://github.com/defunkt/jquery-pjax), [$.Router]("http://router.laserdesignstudio.it/) (*even me*), etc etc.
But *unfortunately* crawlers can’t deal with javascript retrieved content. That’s why the solution is **jBridge**.


How it works.
-------

**jBridge** leaves routing, templating and the other backend stuff on **the backend**, this allow it to be *easy*, *abstract* and *versatile*.
It basically works in *2 way*, “**First Load**” and “**Page Change**”.

You find a site on [Google](http://google.com), [this one](http://getjbridge.com/) for example, you click on the link and browser load it.
In case it’s a *jBridge*-enabled site, it will load as *every website* on the web, receiving a *text/html* response via **GET** request.
When the document will be ready, the plugin will initialize itself, caching elements, attaching event handlers and setting the *.active* menu item.
After that, [onLoad](http://getjbridge.com/frontend-setup#onLoad) and functions will be executed synchronously.

Once jBridge has been initialized, when an anchor that matches the *CSS selector* [internalAnchor](http://getjbridge.com/frontend-setup#internalAnchor) gets clicked, the “**Page Change**” procedure begins.
First of all, the *.active* menu items get updated (*see [how](http://getjbridge.com/frontend-setup#menuManagement) jBridge matches the right current anchors*). Then the “page” starts to **unload**, the operation queue gets cleared and jBridge executes [onUnload](http://getjbridge.com/frontend-setup#onUnload) function (sync).
Secondly, the plugin use the [current pathname](http://getjbridge.com/frontend-setup#currentPathname) to make a **GET** request to the server that will respond with a **json** that can contain: *title*, *styles*, *scripts* and *sections*. The *page title* gets replaced, *styles* and *scripts* after an **existance check** get appended and finally *sections*, matching **sectionName <-> #id** get replaced.
On styles and scripts load, jBridge end the page change calling [.onLoad()](http://getjbridge.com/frontend-setup#onLoad).
