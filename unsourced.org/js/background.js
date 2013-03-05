
/* NOTES:
 * we've got a couple of things to track for each augmented page:
 * 1) the lookup request to unsourced.org. We want to kick this off as early
 *    as we can.
 * 2) the state of the page content. We can't display any overlays until the
 *    page is ready.
 * We track the states of these by adding an object to the tab object.
 */


console.log("HELLO WORLD!");

function UnsourcedState(guiUpdateFunc) {
  this.contentReady = false;
  this._guiUpdateFunc = guiUpdateFunc;

  this.overlaysApplied = false; // have overlays been injected into the page?

  this.lookupState = "none"; // none, pending, ready, error
  this.lookupResults = null;  // only set if state is 'ready'

  this.pageDetails = null; // set by domReady()
  //  this.url = undefined; // set by startLookup()
}

UnsourcedState.prototype.lookupFinished = function(lookupResults) {
  console.log("lookupFinished");
  if(this.lookupState=="none" || this.lookupState=="pending") {
    //

    this.lookupResults = lookupResults;    
    this.lookupState = "ready";

    this._guiUpdateFunc(this);
  }
};

UnsourcedState.prototype.lookupError = function() {
  console.log("lookupError");
  this.lookupState = "error";
  this._guiUpdateFunc(this);
}

UnsourcedState.prototype.domReady = function(pageDetails) {
  console.log("domReady (pageDetails.ogType="+pageDetails.ogType+", pageDetails.indicatorsFound="+pageDetails.indicatorsFound+")" );
  this.pageDetails = pageDetails;
  if(this.contentReady!=true) {
    this.contentReady = true;
    this._guiUpdateFunc(this);
  }
};

UnsourcedState.prototype.startLookup = function(url) {
  var state = this;
  var options = getOptions();
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



function getOptions() {
  return {'search_server':'http://unsourced.org'};
}



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



/* update the gui to reflect the current state
 * the state tracker object calls this every time something changes
 * (eg lookup request returns)
 */
function update_gui(tabid, state)
{
  console.log("update_gui", state);
  if( state===undefined ) {
    // not tracking this tab
    chrome.browserAction.setBadgeText({"tabId": tabid, "text": null});
    chrome.browserAction.setTitle({"tabId": tabid, "title": ""});
    chrome.browserAction.setIcon({"tabId": tabid, "path": "img/unsourced.org"});
    // TODO: disable popup (or show another popup)
    return;
  }

  // ready to add overlays to the webpage (eg warning labels)?
  if(state.lookupState=="ready" && state.contentReady==true && state.overlaysApplied!==true) {
    if( state.lookupResults.labels ) {
      chrome.tabs.sendMessage(
        tabid,
        {'method': 'showWarningLabels', 'labels': state.lookupResults.labels}
      );
      state.overlaysApplied = true;
    }
  }

  // if there's an popup active, tell it to refresh
  chrome.extension.sendMessage({'method':'refresh_popup'});

  // sort out icon and badge
  var tooltip_txt = "";
  var badge_txt = "";
  var badge_colour = "#888888";
  var icon_img = "img/unsourced.png";
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
          icon_img = "img/sourced.png";
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
  chrome.browserAction.setIcon({"tabId": tabid, "path": icon_img});

}


chrome.extension.onMessage.addListener( function(req, sender, sendResponse) {
  console.log( "background.js: received "+ req.method);
  if(req.method == "pageExamined") {
    var state = TabTracker[sender.tab.id];
    if( state === undefined )
      return; // we're not covering this page
    state.domReady(req.pageDetails);
  }
});


chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId != 0)
      return;
  console.log("onCommitted tabid=", details.tabId);
  // attach out state tracker to the tab
  var state = new UnsourcedState(
    function (state) {update_gui(details.tabId, state);}
  );
  TabTracker[details.tabId] = state;

  // Inject our extra content scripts and css into the page
  // Could inject via manifest file, but we can support a blacklist here
//  chrome.tabs.insertCSS(details.tabId, {file: "/css/unsourced.css"});
  // TODO: kill jQuery. It's overkill here.
//  executeScriptsSynchronously(details.tabId, ["/js/lib/jquery.js", "/js/content.js"], function() {

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

  var state = TabTracker[details.tabId];
  if( state === undefined )
    return; // we're not covering this page

  // ask the content script to take a look through the page, to see if it
  // looks like an article or something

//  chrome.tabs.sendMessage(details.tabId, {'method': 'examinePage'}, function(result) { state.domReady(result); } );
});



chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if( TabTracker[tabId] !== undefined ) {
    delete TabTracker[tabId];
  }
});

console.log("F.A.B.");

