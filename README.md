jBridge
=======

	jBridge, the missing piece. An easy, abstract and versatile AJAX + History API site manager.


Just few words first.
=======

AJAX is the key to a flawless site navigation.
I’ve always hated the moment when the browser blanks the viewport to replace the old content with the next page from the same site. Website navigation is like walking, you don’t just teleport yourself from place to place: step by step, you reach it.

This idea has been known for years, many tried to make it simple: jQuery Address, jQuery-pajax, $.Router (even me), etc etc.
But unfortunately crawlers can’t deal with javascript retrieved content. That’s why the solution is jBridge.


How it works.
=======

jBridge leaves routing, templating and the other backend stuff on the backend, this allow it to be easy, abstract and versatile.It basically works in 2 way, “First Load” and “Page Change”.

You find a site on Google, this one for example, you click on the link and browser load it.
In case it’s a jBridge-enabled site, it will load as every website on the web, receiving a text/html response via GET request.
When the document will be ready, the plugin will initialize itself, caching elements, attaching event handlers and setting the .active menu item.
After that, .onLoad() and .onPageLoad() functions will be called in sequence.

Once jBridge has been initialized, when an anchor that matches the CSS selector internalAnchor gets clicked, the “Page Change” procedure begins.
First of all, the .active menu items get updated (see how jBridge matches the right current anchors). Then the “page” start to unLoad and jBridge calls the two relative functions: .onUnload() and .onPageUnload().
Secondly, the plugin use the current pathname to make a POST request to the server that will respond with a json containing: title, styles, scripts and sections. The page title gets replaced, styles and scripts after an existance check get appended and finally sections, matching name and #id of elements in the DOM, get replaced.
On styles and scripts load, jBridge end the procedure calling .onLoad() and .onPageLoad().
