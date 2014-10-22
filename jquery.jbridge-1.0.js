/**
*	@project: jBridge, the missing piece
*	@version: 1.0.2
*	@description: an easy, abstract and versatile AJAX + History API site manager
*	@author: Laser Design Studio http://laserdesignstudio.it
*/
(function($) {	
	jQuery.jBridge = function(options) {
		var bridge = {},
			globalDeferred = $.Deferred().resolve().promise(),
			deferredStackCount = 0,
			bridgeQueue = $({});
		
		// Plugin's options obj ============================================================
		// =================================================================================
		var settings = $.extend({
				/**
				* @type: CSS selector
				* Matches menu(s) anchors
				*
				* #examples: '#you .just > #have-to.match .menu a'
				*/
				menuAnchors: 'nav.main a',
				/**
				* @type: CSS selector / null
				* Matches anchors' parent that will get .active class
				* leave null if you want that class on anchors
				*/
				menuAnchorsContainer: null,
				/**
				* @type: CSS selector
				* Matches anchors to be AJAXified
				*/
				internalAnchors: 'a[href^="/"]',
				/**
				* @type: function / object
				* - defaults to bridge.bypass to just skip to the next function;
				* - can be overridden with a function that must .hold() and .release()
				* 	jBridge during its execution or just .bypass() if it can run asynchronously;
				* - can be overridden with an object like that:
				*		{
				*			'/': function() {},
				*			'/pathname': function() {},
				*			'/path/to/page': function() {},
				*		}
				*	property name is a part of the route(s) that has
				*	to be set up with that function
				*/
				onUnload: bridge.bypass,
				/**
				* @type: function / object
				* same as onUnload, the only difference is that onLoad is called after
				* the page load (of course)
				*/
				onLoad: bridge.bypass,
				/**
				* @type Function( jqXHR jqXHR, String textStatus, String errorThrown )
				* Called on AJAX page request error
				*/
				onError: bridge.bypass,
				/**
				* @type: function / null
				* Called on hashFragment change
				*/
				onHashChange: null,
				/**
				* CURRENTLY UN-IMPLEMENTED
				* @type: function
				* Called on form submit, context is the submitted form
				*
				* onFormSubmit: bridge.bypass,
				*/
				/**
				* @type: boolean
				* Hey jBridge, talk to me!
				*/
				debug: false,
				/**
				* @type boolean
				* Whether or not to request responseType to be jsonp
				* (May be removed soon)
				*/
				requestJsonp: false,
				/**
				* @type object
				* Additional request headers that to be added
				* to jBridge GET request
				*
				* #example: {headerName: 'Header-Value'}
				*/
				additionalRequestHeaders: {},
				
			}, options);
		
// Elements cache ==================================================================
// =================================================================================
		var $body = $('body'),
			$anchors = $(settings.menuAnchors);
		
// Utility functions ===============================================================
// =================================================================================
		/**
		* Match related setup function in an object by pathname
		*
		* @param {object} obj
		* @param {string} pathname
		* @return {array} an array with matching functions
		*/
		var getSetupFunctions = function(obj, pathname) {
			// If obj is function, return it inside an array
			if ($.isFunction(obj)) return [obj];
			
			// Initialize array and iterate through obj properties
			var f = [];
			for (var key in obj)
				// If pathname string starts with current properties name
				if (pathname.indexOf(key) == 0)
					// Push current function to array
					f.push(obj[key]);
			
			// If no matching function found push bridge.bypass
			if (f.length == 0) f.push(bridge.bypass);
			
			// Return the array of matching functions
			return f;
		};
		
		/**
		* Returns current pathname
		*
		* @return {string}
		*/
		bridge.getPathname = function() {
			return document.location.pathname.replace(/#.*$/, '');
		};
		
		/**
		* Logs 'message' if settings.debug is true
		* different type of log can be set via second parameter
		*
		* @params {mixed} message, something to log
		* @param {number} logType
		*/
		bridge.LOG_MESSAGE = 0;
		bridge.LOG_WARN = 1;
		bridge.LOG_ERROR = 2;
		bridge.log = function(message, logType) {
			methods = ['info', 'warn', 'error'];
			logType = (logType) ? logType : 0;
			
			if (settings.debug)
				console[methods[logType]]('jBridge: ' + message);
		}
		
		/**
		* Append 'url' to current pathname by replaceState
		*
		* @param {string} url
		*/
		bridge.replaceAppend = function(url) {
			history.replaceState(history.state, '', bridge.getPathname() + url);
		};
		
		/**
		* Put bridge on hold, waiting for an amount of bridge.release()
		* ugual to stackCount to proceed to the next step.
		* 
		* @param {number} stackCount
		* @return {jQuery.Promise}
		*/
		bridge.hold = function hold(stackCount) {
			bridge.log('on hold');
			
			if (globalDeferred.state() != 'resolved' || globalDeferred.state() != 'rejected') {
				// Set deferredStackCount to stackCount or 1
				deferredStackCount = (stackCount) ? stackCount : 1;
				
				// Create a new deferred and return its promise
				// Change state to busy
				globalDeferred = $.Deferred();
				return globalDeferred.promise();
			}
		};
		
		/**
		* Release bridge from hold and decrease deferredStackCount
		* if stackCount is 0, .resolve() globalDeferred, dequeue() and log
		*
		* @return {jQuery.Promise}
		*/
		bridge.release = function release() {
			if (globalDeferred.state() == 'resolved' || globalDeferred.state() == 'rejected')
				return;
			
			// Decrease the stack count and log
			if (deferredStackCount > 0) deferredStackCount--;
			bridge.log('stack length -> ' + deferredStackCount);
			
			// If stack count is 0 resolve deferred and dequeue
			if (deferredStackCount == 0) {
				bridge.log('released');
				globalDeferred.resolve();
				bridgeQueue.dequeue('op');
			}
		};
		
		/**
		* Just return a promise from the globalDeferred
		*
		* @return {jQuery.Promise}
		*/
		bridge.getPromise = function() {
			return globalDeferred.promise();
		};
		
		/**
		* Execute next function in queue by dequeue()
		*
		* @return {jQuery.Promise}
		*/
		bridge.bypass = function bypass() {
			bridgeQueue.dequeue('op');
		};
		
// Event Handlers ==================================================================
// =================================================================================
		// AJAXify all internal anchors
		$(document).on('click', settings.internalAnchors, function(e) {
			e.preventDefault();
			
			var $anchor = $(this),
				href = $anchor.attr('href');
			
			// If same path, do nothing
			if (href == bridge.getPathname())
				return false;
			
			// Log link click
			bridge.log('click on internal anchor: ' + href);
			
			// Else push anchor href and load page
			bridge.load(href);
		});
		
		// Handle hash-change event if handler has been specified
		$(document).on('click', 'a[href^=#]', function(e) {
			hashChanged = true;
			
			if ($(this).attr('href') == '#') return;
			if (settings.onHashChange === null) return;
				
			// Get hashFragment, log and call onHashChange
			var hashFragment = $(this).attr('href');
			bridge.log('click on hash anchor: ' + hashFragment);
			settings.onHashChange(hashFragment);
			
			return false;
		});
		
		// Handle onpopstate event preventing the first
		// and unuseful fire in webkit browsers
		var initialLoad = false,
			hashChanged = false;
		window.onpopstate = function() {
			// If hashChanged by clicking a link, return
			if (hashChanged) {
				hashChanged = false;
				return false;
			}
			// Check if window.load has been fired once
			if (!initialLoad) return false;
			
			// Log
			bridge.log('onpopstate triggered');
			
			bridge.load();
			return false;
		};
		
		// Wait for window onLoad to init plugin
		$(window).one('load', function() {
			var currentPath = bridge.getPathname(),
				loadSetup = getSetupFunctions(settings.onLoad, currentPath);
			
			// Select current menu item
			setActiveItem();
			
			// If hash exist on page load, call onHashChange
			if (location.hash && settings.onHashChange !== null) {
				// Get hashFragment, log and call onHashChange
				bridge.log('found hashFragment onload, calling onHashChange');
				settings.onHashChange(location.hash);
			}
			
			// Queue load setup operations
			bridgeQueue
				.queue('op', loadSetup)
				.dequeue('op');
			
			// Enable onpopstate listener
			setTimeout(function() {initialLoad = true;}, 0);
		});

// Main functions ==================================================================
// =================================================================================
		/**
		* Match the current anchor among settings.menuAnchors
		* and adds .active class to it or its parent
		* based on settings.menuAnchorsContainer 
		*/
		var setActiveItem = function() {
			var currentPath = bridge.getPathname(),
				$targetElements = $anchors;
			
			// Remove previously added .active classes
			if (settings.menuAnchorsContainer === null)
				$anchors.removeClass('active');
			else
				$anchors.parent(settings.menuAnchorsContainer).removeClass('active');
			// Filter $anchors keeping only the ones whose href
			// has a match in the currentPath
			$targetElements = $targetElements.filter(function(index) {
				return currentPath.indexOf($(this).attr('href')) != -1;
			});
			
			// If an anchors container has been set, select them
			if (settings.menuAnchorsContainer !== null)
				$targetElements = $targetElements.parents(settings.menuAnchorsContainer)
			
			// Log error if no elements targeted
			if (!$targetElements.length)
				bridge.log("couldn't find any menu item to activate, check menu settings or your menu markup.", bridge.LOG_WARN);
			else
				// Finally add .active classes
				$targetElements.addClass('active');
		};
		
		/**
		* Replace sections received by requestPage
		* 'title', 'stylesheets' and 'scripts' are treated as special sections
		*
		* #NOTE: title section must contain a <title /> element, not just plain text
		*
		* @param {Object} pageSections
		* @return {jQuery.Promise}
		*/
		bridge.replaceContent = function(pageSections) {
			// Replace title
			var title = $(pageSections['title']).filter('title').text();
			$('head > title').text(title);
			delete pageSections['title'];
			
			// Append stylesheets
			bridge.appendStyles(pageSections['stylesheets']);
			delete pageSections['stylesheets'];
			
			// Append scripts
			bridge.appendScripts(pageSections['scripts']);
			delete pageSections['scripts'];
			
			// Replace sections and log
			bridge.log('replacing sections');
			var sectionCount = 0;
			$.each(pageSections, function(name, content) {
				sectionCount++;
				$('#' + name).html($.parseHTML(content, document, true));
			});
			
			// Log replaced section count
			bridge.log('replaced ' + sectionCount + ' section' + ((sectionCount > 1) ? 's' : ''));
		};
		
		/**
		* Check if styles do not exist in DOM and append them if necessary
		*
		* @param {string} styles
		*/
		bridge.appendStyles = function(styles) {
			var $styles = $(styles);
			
			// If no stylesheets passed, exit
			if (!$styles.length) return;
			
			// Log stylesheets discovery
			bridge.log($styles.length + ' stylesheet' + (($styles.length > 1) ? 's' : '') + ' found, checking existance');
			
			$.each($styles, function(index, style) {
				// Cache style element and its properties
				var $style = $(style),
					href = $style.attr('href'),
					name = href.split('/').slice(-1)[0];
				
				// Check if stylesheet already exist in DOM
				if ($('link[href$="' + name + '"]').length)
					return;
				
				// Log style's href
				bridge.log('appending stylesheet -> ' + href);
				
				// Append the stylesheet element to head
				$('head').append($style);
			});
		};
		
		/**
		* Check if scripts do not exist in DOM and append them if necessary.
		*
		* @param {string} scripts
		* @return {jQuery.Promise}
		*/
		bridge.appendScripts = function(scripts) {
			var $scripts = $($.trim(scripts));
			
			// If no script passed, exit
			if (!$scripts.length) return bridge.bypass();
			
			// Log script discovery
			bridge.log($scripts.length + ' script' + (($scripts.length > 1) ? 's' : '') + ' found, checking existance');
			
			// Hold jBridge for any script not async or which src contains bridge.release
			bridge.hold(
				$scripts.filter(':not([async])').length +
				$scripts.filter('[src*="bridge.release"]').length
			);
			
			$.each($scripts, function(index, script) {
				// Cache script element and its properties
				var $script = $(script),
					src = $script.attr('src');
				
				// Check if script already exist in DOM
				if ($('script[src="' + src + '"]').length) {
					// If there's a callback to bridge.release,
					// manually release brige once
					if (src.match('bridge.release'))
						bridge.release();
					
					return bridge.release();
				}
				
				// Log script's src
				bridge.log('appending script -> ' + src);
				
				// Create script element, append it
				// and wait its load to release jBrisge
				$script = $('<script />');
				$('body').append($script);
				$script.one('load', bridge.release);
				$script.attr('src', src);
			});
		};
		
		/**
		* Make a GET request using window.location,
		* jBridge request can be recognized on backend by checking
		* jQuery.ajax() request header -> X-Requested-With: "XMLHttpRequest"
		*
		* @return {jQuery.Deferred}
		*/
		bridge.requestPage = function() {
			bridge.log('requesting page: ' + window.location);
			
			var requestSettings = {
				url: window.location,
				dataType: settings.requestJsonp ? 'jsonp': 'json',
				headers: settings.additionalRequestHeaders,
				success: function(pageSections) {
					// Replace page content and log ajax request success
					bridge.log('successfully retrieved page: ' + window.location);
					bridge.replaceContent(pageSections);
				},
				error: function(jqXHR, textStatus, errorThrown) {
					// Clear queue and queue onError function
					bridgeQueue
						.clearQueue('op')
						.queue('op', [settings.onError.bind(this, arguments)])
						.dequeue();
				}
			};
			
			// Hold jBridge and request page,
			// it'll be released by replaceContent function
			bridge.hold();
			$.ajax(requestSettings);
		};
		
		/**
		* jBridge's "pearl" function.
		* Set the active item(s) in the menu(s) and execute synchronously
		* the page update procedure
		*
		* @param {string} url, a URL to push and load
		*/
		bridge.load = function(url) {
			// If url given, pushState first
			if (url) history.pushState({'route': url}, '', url);
			
			// Match related setup function by pathname
			var currentPathname = bridge.getPathname();
			var unloadSetup = getSetupFunctions(settings.onUnload, currentPathname);
			var loadSetup = getSetupFunctions(settings.onLoad, currentPathname);
			
			// Select current menu item
			setActiveItem();
			
			// Queue page change operations
			bridgeQueue
				.clearQueue('op')
				.queue('op', unloadSetup.concat([bridge.requestPage]).concat(loadSetup))
				.dequeue('op');
		};
		
		return bridge;
	};
})(jQuery);