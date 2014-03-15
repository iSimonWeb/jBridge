/**
*	@project: jQuery.Bridge
*	@description: and easy, abstract and versatile AJAX + History API site manager
*	@author: Laser Design Studio http://laserdesignstudio.it
*/
(function($) {
	var synchronize = function(functions) {
		if (functions.length == 1)
			return functions[0]();
		return synchronize(functions.slice(0, -1)).then(functions.pop());
	};
	
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
		
		// If no matching function found
		if (f.length == 0)
			// return bridge.bypass inside an array
			return [bridge.bypass];
		else
			// else return the array of matching functions
			return f;
	};
	
	jQuery.Bridge = function(options) {
		var bridge = {},
			globalDeferred = null,
			deferredStackCount = 0;
		
// Plugin's options obj ============================================================
// =================================================================================
		var settings = $.extend({
				/**
				* @type: CSS selector
				* Matches menu(s)' anchors
				*/
				menuAnchors: 'nav.main a',
				/**
				* @type: CSS selector / null
				* Matches anchor's parent that will get .active class
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
				* - defaults to bridge.bypass to return a resolved Promise doing nothing;
				* - can be overridden with a function that must return a Promise
				*	that will be manually resolved by the function itself,
				*	or it can return bridge.bypass() if there's nothing to wait for;
				* - can be overridden with an hash like this:
				*		{
				*			'/': function() {},
				*			'/pathname': function() {},
				*			'/path/to/page': function() {},
				*		}
				*	property name is a part of the route(s) to be set up with the function
				*/
				onUnload: bridge.bypass,
				/**
				* @type: function / object
				* same as onUnload, the only difference is that onLoad is called after
				* the current page load (of course)
				*/
				onLoad: bridge.bypass,
				/**
				* @type: function / null
				* a function to be called every time hashFragment changes
				*/
				onHashChange: null,
				/**
				* @type: function / null
				* a function to be called on form submit
				*/
				//onFormSubmit: function() {},
				/**
				* @type: boolean
				* Hey jBridge, talk to me!
				*/
				debug: false,
				/**
				*
				*/
				requestJsonp: false,
				/**
				*
				*/
				additionalRequestHeaders: {},
				
			}, options);
		
// Elements cache ==================================================================
// =================================================================================
		var $body = $('body');
		var $anchors = $(settings.menuAnchors);
		
// Utility functions ===============================================================
// =================================================================================
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
		*
		* @params {mixed} message, something to log
		*/
		bridge.log = function(message) {
			if (settings.debug)
				console.log(message);
		}
		
		/**
		* Replace current pathname and load url
		* 
		* @param {string} url
		*/
		bridge.goto = function(url) {
			history.pushState({'route': url}, '', url);
			bridge.load();
		};
		
		/**
		* Append 'url' to current pathname
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
		bridge.hold = function(stackCount) {
			bridge.log('Bridge is on hold');
			
			if (globalDeferred === null) {
				// Set deferredStackCount to stackCount or 1
				deferredStackCount = (stackCount !== undefined) ? stackCount : 1;
				
				// Create a new deferred and return its promise
				globalDeferred = new $.Deferred();
				return globalDeferred.promise();
			}
		};
		
		/**
		* Release bridge from hold.
		* decrease deferredStackCount and if 0 .resolve() the globalDeferred
		*
		* @return {jQuery.Promise}
		*/
		bridge.release = function() {
			if (globalDeferred === null) return;
			
			// Decrease the stack count
			if (deferredStackCount > 0)
				deferredStackCount--;
			
			bridge.log('Stack length -> ' + deferredStackCount);
			
			// If stack count is 0, .resolve() the globalDeferred
			// as nullify it
			if (deferredStackCount == 0) {
				bridge.log('Bridge released');
				
				globalDeferred.resolve();
				globalDeferred = null;
			}
		};
		
		/**
		* Just return a promise from the globalDeferred,
		* if it's null, returns a resolved one
		*
		* @return {jQuery.Promise}
		*/
		bridge.getPromise = function() {
			if (globalDeferred === null)
				return bridge.bypass();
			
			return globalDeferred.promise();
		};
		
		/**
		* Do nothing, used when bridge can continue executing
		*
		* @return {jQuery.Promise}
		*/
		bridge.bypass = function() {return (new $.Deferred()).resolve().promise();};
		
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
			bridge.log('Click on: "' + href + '"');
			
			// Else push anchor href and load page
			bridge.goto(href);
		});
		
		// Handle hash-change event if handler has been specified
		$(document).on('click', 'a[href^=#]', function(e) {
			if (settings.onHashChange === null)
				return false;
			
			var hashFragment = $(this).attr('href');
			//bridge.replaceAppend(hashFragment);
			settings.onHashChange(hashFragment);
			
			return false;
		});
		
		// Handle onpopstate event preventing the first
		// and unuseful fire in webkit browsers
		var initialLoad = false;
		window.onpopstate = function() {
			// Check if window.load has been fired once
			if (!initialLoad) return false;
			
			bridge.load();
			return false;
		};
		
		// Wait for window onLoad to init plugin
		$(window).one('load', function() {
			var currentPath = bridge.getPathname();
			var loadSetup = getSetupFunctions(settings.onLoad, currentPath);
			
			// Select current menu item
			setActiveItem();
			
			// Synchronize plugin operation
			synchronize(loadSetup);
			
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
			$anchors.removeClass('active');
			// Filter $anchors keeping only the ones whose href
			// has a match in the currentPath
			$targetElements = $targetElements.filter(function(index) {
				return currentPath.indexOf($(this).attr('href')) != -1;
			});
			
			// If an anchors container has been set, select them
			if (settings.menuAnchorsContainer !== null)
				$targetElements = $targetElements.parents(settings.menuAnchorsContainer)
			
			// Finally add .active classes
			$targetElements.addClass('active');
		};
		
		/**
		* Make a POST request using window.location
		*
		* @return {$.Deferred}
		*/
		bridge.requestPage = function() {
			bridge.log('Requesting page: ' + window.location);
			
			var requestSettings = {
				url: window.location,
				dataType: settings.requestJsonp ? 'jsonp': 'json',
				headers: settings.additionalRequestHeaders,
				success: function (data) {
					// Log success ajax request
					bridge.log('Successfully retireved page: ' + window.location);
				}
			};
			
			return $.ajax(requestSettings).promise();
		};
		
		/**
		* Replace sections received by requestPage
		* 'title', 'stylesheets' and 'scripts'
		* are treated as special sections
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
			var scriptsPromise = bridge.appendScripts(pageSections['scripts']);
			delete pageSections['scripts'];
			
			// Log sections replacement
			bridge.log('Replacing section(s)');
			// Replace sections
			$.each(pageSections, function(name, content) {
				$('#' + name).html($.parseHTML(content));
			});
			
			if (scriptsPromise)
				return scriptsPromise;
			else
				return bridge.bypass();
		};
		
		/**
		* Check if styles do not exist in DOM
		* and append them if necessary
		*
		* @param {string} styles
		*/
		bridge.appendStyles = function(styles) {
			var $styles = $(styles);
			
			// If no stylesheets passed, exit
			if (!$styles.length) return;
			
			// Log stylesheets discovery
			bridge.log($styles.length + ' stylesheet(s) found, checking existance');
			
			$.each($styles, function(index, style) {
				var $style = $(style);
				var href = $style.attr('href');
				var name = href.split('/').slice(-1)[0];
				
				// Check if stylesheet already exist in DOM
				if ($('link[href$="' + name + '"]').length)
					return;
				
				// Log style's href
				bridge.log('Appending stylesheet -> ' + href);
				
				// Otherwise append the stylesheet to head
				$('head').append($style);
			});
		};
		
		/**
		* Check if scripts do not exist in DOM
		* and append them if necessary.
		* Call settings.onScriptsLoad on appended scripts load
		*
		* @param {string} scripts
		* @return {jQuery.Promise}
		*/
		bridge.appendScripts = function(scripts) {
			var $scripts = $($.trim(scripts));
				//deferreds = [];
			
			// If no script passed, exit
			if (!$scripts.length) return;
			
			// Log script discovery
			bridge.log($scripts.length + ' script(s) found, checking existance');
			bridge.hold(
				$scripts.filter(':not([async])').length +
				$scripts.filter('[src*="bridge.release"]').length
			);
			
			$.each($scripts, function(index, script) {
				var $script = $(script);
				var src = $script.attr('src');
				var async = $script.is('[async]');
				
				// Check if script already exist in DOM
				if ($('script[src="' + src + '"]').length) {
					// If there's a callback to bridge.release,
					// manually release brige once
					if (src.match('bridge.release'))
						bridge.release();
					
					return bridge.release();
				}
				
				// Log script's src
				bridge.log('Appending script -> ' + src);
				
				// Create script element
				$script = $('<script />');
				$('body').append($script);
				$script.one('load', bridge.release);
				$script.attr('src', src);
			});
			
			// Return a Promise to wait scripts load
			return bridge.getPromise();
		};
		
		/**
		* "Main" jBridge function.
		* Set the active item(s) in the menu(s) and call synchronously
		* the page update procedure
		*/
		bridge.load = function() {
			var currentPath = bridge.getPathname();
			var unloadSetup = getSetupFunctions(settings.onUnload, currentPath);
			var loadSetup = getSetupFunctions(settings.onLoad, currentPath);
			
			// Select current menu item
			setActiveItem();
			
			// Synchronize plugin operation
			synchronize(
				unloadSetup.concat([
					bridge.requestPage,
					bridge.replaceContent,
				]).concat(loadSetup)
			);
		};
		
		return bridge;
	};
})(jQuery);