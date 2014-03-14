/**
*	@project: jQuery.Bridge v0.1
*	@description: and easy, abstract and versatile AJAX + History API site manager
*	@author: Laser Design Studio http://laserdesignstudio.it
*/
(function($) {
	var synchronize = function(functions) {
		if (functions.length == 1)
			return functions[0]();
		return synchronize(functions.slice(0, -1)).then(functions.pop());
	};
	
	jQuery.Bridge = function(options) {
		var bridge = {},
			globalDeferred = null,
			deferredStackCount = 0;
		
// Plugin's options obj ============================================================
// =================================================================================
		var settings = $.extend({
				// @type: CSS selector
				// Matches menu(s)' anchors
				menuAnchors: 'nav.main a',
				// @type: CSS selector / null
				// Matches anchor's parent that will get .active class
				// leave null if you want that class on anchors
				menuAnchorsContainer: null,
				// @type: CSS selector
				// Matches anchors to be AJAXified
				internalAnchors: 'a[href^="/"]',
				// define ajax request type
				usePost: true,
				// define ajax request format (if false -> json)
				useJsonP: false,
				// define additional headers on ajax request
				addHeaders: null,
				// 
				onUnload: bridge.bypass,
				//
				onPageUnload: {},
				// 
				onLoad: bridge.bypass,
				// 
				onScriptsLoad: function() {},
				// 
				onPageLoad: {},
				// Fired every time hashFragment is changed
				onHashChange: null,
				// Fired on form-submit
				onFormSubmit: function() {},
				// Hey Bridge, talk to me!
				debug: false
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
		
		bridge.hold = function(stackCount) {
			bridge.log('Bridge is on hold');
			
			if (globalDeferred === null) {
				if (stackCount !== undefined)
					deferredStackCount = stackCount;
				else deferredStackCount++;
				
				globalDeferred = new $.Deferred();
				return globalDeferred.promise();
			}
		};
		
		bridge.release = function() {
			if (globalDeferred === null) return;
			
			if (deferredStackCount > 0)
				deferredStackCount--;
			
			bridge.log('Stack length -> ' + deferredStackCount);
				
			if (deferredStackCount == 0) {
				bridge.log('Bridge released');
				
				globalDeferred.resolve();
				globalDeferred = null;
			}
		};
		
		bridge.getPromise = function() {
			if (globalDeferred === null)
				return bridge.bypass();
			
			return globalDeferred.promise();
		};
		
		/**
		* Do nothing, used when bridge can continue executing
		*
		* @return {$.Promise}
		*/
		bridge.bypass = function() {return (new $.Deferred()).resolve().promise();};
		
		// Match current page function
		var findRelatedFunction = function(obj) {
			var f = bridge.bypass(),
				pathname = bridge.getPathname();
			
			for (var key in obj)
				if (pathname.indexOf(key) == 0)
					f = obj[key];
			
			return f;
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
		
// TO BE FIXED
		// Handle form submit
		/*$(document).on('submit', 'form', function(e) {
			e.preventDefault();
			
			// Retrieve data
			var $this = $(this),
				formID = $this.attr('id'),
				method = $this.attr('method').toLowerCase(),
				url = $this.attr('action'),
				data = JSON.stringify($this.serializeObject());
			
			if ($.inArray(method, ['get', 'post', 'put', 'delete']) === -1)
				return;
			
			$this.addClass('loading');
			$defer = $.ajax({
						'url': url,
						'type': method,
						'data': data,
						'context': this
					});
			settings.onFormSubmit($defer);
		});*/
		
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
			var currentPageLoad = findRelatedFunction(settings.onPageLoad);
			
			// Select current menu item
			setActiveItem();
			
			// Synchronize plugin operation
			synchronize([settings.onLoad, currentPageLoad]);
			
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
				$targetAnchors = $anchors;
			
			$anchors.removeClass('active');
			
			if (settings.menuAnchorsContainer === null)
				$targetAnchors
					.filter(function(index) {
						return currentPath.indexOf($(this).attr('href')) != -1;
					})
					.addClass('active');
			else
				$targetAnchors
					.filter(function(index) {
						return currentPath.indexOf($(this).attr('href')) != -1;
					})
					.parents(settings.menuAnchorsContainer)
							.addClass('active');
		};
		
		/**
		* Make a POST request using window.location
		*
		* @return {jQuery.Deferred}
		*/
		bridge.requestPage = function() {
			bridge.log('Requesting page: ' + window.location);
			
			var ajaxRequest = {
			    url: window.location,
		    	    type: settings.usePost ? 'post' : 'get',
			    dataType: settings.useJsonP ? 'jsonp': 'json',
			    success: function (data) {
			        // Log success ajax request
				bridge.log('Successfull page retrieve');
			    }
			};
			
			//header example: 
			//Header_Name_One: 'Header Value One',   //If your header name has spaces or any other char not appropriate
		        //"Header Name Two": 'Header Value Two'  //for object property name, use quoted notation shown in second
			if (settings.addHeaders){
				ajaxRequest.headers = settings.addHeaders;
			} 
			
			//send via get or post with additional headers in json or jsonp format
			return $.ajax(ajaxRequest);
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
		* Synchronize plugin operations
		*/
		bridge.load = function() {
			var currentPath = bridge.getPathname();
			var currentPageUnload = findRelatedFunction(settings.onPageUnload);
			var currentPageLoad = findRelatedFunction(settings.onPageLoad);
			
			// Select current menu item
			setActiveItem();
			
			// Synchronize plugin operation
			synchronize([
				settings.onUnload,
				currentPageUnload,
				bridge.requestPage,
				bridge.replaceContent,
				settings.onLoad,
				currentPageLoad
			]);
		};
		
		return bridge;
	};
})(jQuery);
