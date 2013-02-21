
/* NOTES:
 * we've got a couple of things to track for each augmented page:
 * 1) the lookup request to unsourced.org. We want to kick this off as early
 *    as we can.
 * 2) the state of the page content. We can't display any overlays until the
 *    page is ready.
 * We track the states of these by adding an object to the tab object.
 */


console.log("HELLO WORLD!");

function UnsourcedState(goFunc,guiUpdateFunc) {
  this._contentReady = false;
  this._goFunc = goFunc;
  this._guiUpdateFunc = guiUpdateFunc;

  this.lookupState = "none"; // none, pending, ready, error
  this.lookupResults = null;  // only set if state is 'ready'

  // this.pageDetails = undefined // set by contentReady()
  //  this.url = undefined; // set by startLookup()
}

UnsourcedState.prototype.lookupFinished = function(lookupResults) {
  console.log("lookupFinished");
  if(this.lookupState=="none" || this.lookupState=="pending") {
    //

    this.lookupResults = lookupResults;    
    this.lookupState = "ready";

    this._guiUpdateFunc(this);
    if(this._contentReady) {
      this._goFunc();
    } 
  }
};

UnsourcedState.prototype.lookupError = function() {
  console.log("lookupError");
  this.lookupState = "error";
  this._guiUpdateFunc(this);
}

UnsourcedState.prototype.contentReady = function(pageDetails) {
  console.log("contentReady");
  this.pageDetails = pageDetails;
  if(this._contentReady!=true) {
    this._contentReady = true;
    this._guiUpdateFunc(this);
    if(this.lookupState=="ready") {
      this._goFunc();
    } 
  }
};

UnsourcedState.prototype.startLookup = function(url) {
  var state = this;
  var options = restoreOptions();
  var search_url = options.search_server + '/api/lookup?url=' + encodeURIComponent(url);

  state.url = url;

  console.log("startLookup("+url+")");
  this.lookupState = "pending";
  this._guiUpdateFunc(this);

  /* firefox version
  var req = Request({
    url: search_url,
    onComplete: function (response) {
      if( response.status==200) {
        state.lookupFinished(response.json);
      } else {
        //TODO: indicate error
        // state.lookupFailed();
      }
    }
  }).get();
  */
  $.ajax({
    type: "GET",
    url: search_url,
    dataType: 'json',
    success: function(result) {
      state.lookupFinished(result);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      state.lookupError();
      console.log("Error:", jqXHR, textStatus, errorThrown);
    }
  });
};


// returns true if the page is definitely _not_ an article
UnsourcedState.prototype.isNonArticle = function() {
  var pd = this.pageDetails;

  var o = parseUri(this.url);
  if( !o.path.match(/.{5,}/)) {
    return true;
  }

  if( pd.ogType!==undefined && pd.ogType!='article') {
    return true;
  }

  return false;
};


/* end UnsourcedState */

/* map our extra state to open tabs */
TabTracker = {};



function restoreOptions() {
  return {'search_server':'http://unsourced.org'};
}







function onRequest(request, sender, response)
{
    console.log(request.method, request, sender);

    if (request.method == 'getAllBrowserTabs') {
        chrome.windows.getAll({populate: true}, function(windows){
            var tabs = [];
            jQuery(windows).each(function(winIdx, win){
                jQuery(win.tabs).each(function(tabIdx, tab) {
                    tabs.push(tab);
                });
            });
            response(tabs);
        });

    } else if (request.method == 'showOptionsPage') {
        chrome.tabs.create({
            url: chrome.extension.getURL("html/options.html")
        });
    } else if (request.method == 'whoami?') {
        response(sender.tab);

    } else if (request.method == "getOptions") {
        response(restoreOptions());

    } else if (request.method == "saveOptions") {
        response(saveOptions(request.options));

    } else if (request.method == "resetOptions") {
        response(resetOptions());

    } else if (request.method == "addToWhitelist") {
        var options = restoreOptions();
        if (options.sites.indexOf(request.site) == -1) {
            options.sites.push(request.site);
            saveOptions(options);
        }
        response(options);

    } else if (request.method == "removeFromWhitelist") {
        var options = restoreOptions();
        var offset = options.sites.indexOf(request.site);
        if (offset >= 0) {
            options.sites.splice(offset, 1);
            saveOptions(options);
        }
        response(options);

    } else if (request.method == "log") {
        console.log(request.args);
    }
}


chrome.extension.onRequest.addListener(onRequest);


function buildMatchPatterns(sites) {

  return sites.map(function(site) {
    var pat = site;
    var wild_host = (pat[0]=='.');
    var wild_path = (pat.slice(-3)=='...');

    if(wild_host) {
      pat = pat.slice(1);
    }
    if(wild_path) {
      pat = pat.slice(0,-3);
    }

    pat = pat.replace( /[.]/g, "[.]");

    if(wild_host) {
      pat = '[^/]*' + pat;
    }

    pat = "https?://" + pat + '.*';

    return new RegExp(pat);
  });
}


function is_news_article(url) {
  var loc = parseUri(url);

  // don't check front page
  if (loc.path == '/')
     return false;

  if (loc.host == 'scumways.com')
    return true;
  if(loc.host == 'www.dailymail.co.uk')
    return true;
  if(loc.host == 'www.telegraph.co.uk')
    return true;
  if(loc.host == 'www.guardian.co.uk')
    return true;
  if(loc.host == 'www.stuff.co.nz')
    return true;
  return false;

/*
  if (onWhitelist({'host': loc.host, 'pathname': loc.path})) {
    return true;
  } else {
    return false;
  }
*/
}

var onWhitelist = function (location) {
    // This function is replaced by compileWhitelist
    return false;
};

var compileWhitelist = function () {
    console.log("Recompiling onWhitelist");

    var host_matcher = function (s) {
        if (s[0] == '.') {
            return function (location) {
                return (location.host.slice(-s.length) == s);
            };
        } else {
            return function (location) {
                return (location.host == s);
            };
        }
    };

    var path_matcher = function (s) {
        var wild_prefix = (s.slice(0, 3) == '...');
        var wild_suffix = (s.slice(-3) == '...');
        if (wild_prefix && wild_suffix) {
            return function (location) {
                return (location.pathname.indexOf(s) >= 0);
            };
        } else if (wild_prefix) {
            var literal_suffix = s.slice(3);
            return function (location) {
                return (location.pathname.slice(-literal_suffix.length) == literal_suffix);
            };
        } else if (wild_suffix) {
            var literal_prefix = s.slice(0, -3);
            return function (location) {
                return (location.pathname.slice(0, literal_prefix.length) == literal_prefix);
            };
        } else {
            return function (location) {
                return (location.pathname == s);
            };
        }
    };

    var matchers = sites.map(function(site_pattern){
        var slash_offset = site_pattern.indexOf('/');
        if (slash_offset == 0) {
            return path_matcher(site_pattern);
        } else if (slash_offset == -1) {
            return host_matcher(site_pattern);
        } else {
            var hostpart = site_pattern.slice(0, slash_offset);
            var pathpart = site_pattern.slice(slash_offset);
            return function (location) {
                return host_matcher(hostpart)(location) && path_matcher(pathpart)(location);
            };
        };
    });

/*    if (options.use_generic_news_pattern == true) {
        matchers.push(function(loc){
            return /(news|article)/i.test(loc.host + loc.pathname);
        });
    }
*/

    // Replaces onWhitelist in outer scope.
    onWhitelist = function (location) {
        for (var idx = 0; idx < matchers.length; idx++) {
            var matcher = matchers[idx];
            if (matcher(location)) {
                return true;
            }
        }
        return false;
    };
};




var executeScriptsSynchronously = function (tab_id, files, callback) {
    if (files.length > 0) {
        var file = files[0];
        var rest = files.slice(1);
        chrome.tabs.executeScript(tab_id, {file: file}, function(){
            if (rest.length > 0) {
                executeScriptsSynchronously(tab_id, rest, callback);
            } else if (callback) {
                callback.call(null);
            }
        });
    }
};


/* TODO: xyzzy - merge into update_gui() */
function show_results(tabid) {
  var state = TabTracker[tabid];
  if( state===undefined ) {
    console.log("UHOH - show_results() called on tab with no UnsourcedState tabid=", tabid);
    return;
  }

  var ad = state.lookupResults;

  // update popup
  // update widget

  // show any warning labels, overlaid on page
  chrome.tabs.insertCSS(tabid, {file: "/css/unsourced.css"});
  executeScriptsSynchronously(tabid, ["/js/lib/jquery.js", "/js/content.js"],
      function() {

      /* pass the article details in to the content script to present */

      ad.labels = [{'icon_url': chrome.extension.getURL("img/sourced.png"), "prettyname":"Too many fish", "description": "Way too many fish"},];

      var req = { 'method': 'showWarningLabels', 'labels': ad.labels };
      chrome.tabs.sendRequest(tabid, req);
      console.log("Req sent to tab ",tabid, req);
    });

  console.log("show_results", tabid, ad);
  return;
}



/* update the gui to reflect the current state */
function update_gui(tabid, state)
{
  if( state===undefined ) {
    // not tracking this tab
    chrome.browserAction.setBadgeText(null);
    return;
  }

  var tooltip_txt = "";
  var badge_txt = "";
  var badge_colour = "#888888";
  switch( state.lookupState ) {
    case "none":
      break;
    case "pending":
      tooltip_txt = "checking unsourced.org";
      break;
    case "ready":
      {
        var ad = state.lookupResults;
        if( ad.status=='found') {
          badge_txt = "" + ad.sources.length;
          badge_colour = ad.needs_sourcing ? "#cc0000" : "#888888";
          tooltip_txt = "" + ad.sources.length + " sources, " + ad.labels.length + " warning labels"; 
        } else {
          tooltip_txt = "no sources or warning labels";
        } 
      }
      break;
    case "error":
      badge_txt = "err";
      badge_colour = "#ff0000";
      break;
  }

  chrome.browserAction.setBadgeText({"tabId": tabid, "text": badge_txt});
  chrome.browserAction.setBadgeBackgroundColor({"tabId": tabid, "color":badge_colour});
  chrome.browserAction.setTitle({"tabId": tabid, "title": tooltip_txt});
}



chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId != 0)
      return;
  console.log("onCommitted tabid=", details.tabId);
  // we store some extra state about the tab
  var state = new UnsourcedState(
    function () {show_results(details.tabId);},
    function (state) {update_gui(details.tabId, state);}
  );
  TabTracker[details.tabId] = state;

  if(is_news_article(details.url)) {
    console.log("whitelisted: ", details.url);
    state.startLookup(details.url);
  } else {
    console.log("not on whitelist: ", details.url);
  }
});


//chrome.webNavigation.onCompleted.addListener(function(details) {
chrome.webNavigation.onDOMContentLoaded.addListener(function(details) {
  if (details.frameId != 0)
      return;

  state = TabTracker[details.tabId];
  if( state === undefined )
    return; // we're not covering this page
  // TODO: pageDetails to come from content script please!
  pageDetails = {};
  state.contentReady(pageDetails);
});



chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if( TabTracker[tabId] !== undefined ) {
    delete TabTracker[tabId];
  }
});

console.log("F.A.B.");

