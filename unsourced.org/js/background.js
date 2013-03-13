
/* NOTES:
 * we've got a couple of things to track for each augmented page:
 * 1) the lookup request to unsourced.org. We want to kick this off as early
 *    as we can.
 * 2) the state of the page content. We can't display any overlays until the
 *    page is ready.
 * We track the states of these by adding an object to the tab object.
 */



function UnsourcedState(url, guiUpdateFunc) {
  this.url = url;
  this.contentReady = false;
  this._guiUpdateFunc = guiUpdateFunc;

  this.overlaysApplied = false; // have overlays been injected into the page?

  this.lookupState = "none"; // none, pending, ready, error
  this.lookupResults = null;  // only set if state is 'ready'

  this.pageDetails = null; // set by domReady()
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
//  console.log("domReady (pageDetails.ogType="+pageDetails.ogType+", pageDetails.indicatorsFound="+pageDetails.indicatorsFound+")" );
  this.pageDetails = pageDetails;
  if(this.contentReady!=true) {
    this.contentReady = true;
    this._guiUpdateFunc(this);
  }
};

UnsourcedState.prototype.startLookup = function() {
  var state = this;
  var search_url = options.search_server + '/api/lookup?url=' + encodeURIComponent(this.url);


  console.log("startLookup("+this.url+")");
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


// return URL for submitting this article to unsourced
UnsourcedState.prototype.getSubmitURL = function() {
  var submit_url = options.search_server + '/addarticle?url=' + encodeURIComponent(this.url);
  return submit_url;
};

/* end UnsourcedState */

/* map our extra state to open tabs */
TabTracker = {};


/* extension options - (loaded from storage in startup() and changed via storeOptions() */
options = [];


// returns a function that can test a url against the list of sites
// a leading dot indicates any subdomain will do, eg:
//   .example.com             - matches anything.example.com
// a trailing ... is a wildcard, eg:
//   example.com/news/...    - matches example.com/news/moon-made-of-cheese.html
function buildMatchFn(sites) {

  var matchers = sites.map(function(site) {
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


  return function (url) {
    for (var idx = 0; idx < matchers.length; idx++) {
      var re = matchers[idx];
        if( re.test(url)) {
              return true;
        }
    }
    return false;
  };
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

}

var onWhitelist = function (location) {
  // This function is replaced by compileWhitelist
  return false;
};

var onBlacklist = function (location) {
  // This function is replaced by compileBlacklist
  return true;
}


// replace onWhitelist with a function that returns true for whitelisted sites
var compileWhitelist = function () {
//  console.log("Recompiling onWhitelist");
  var sites = news_sites.concat(options.user_whitelist);
  onWhitelist = buildMatchFn(sites);
};

// replace onBlacklist with a function that returns true for whitelisted sites
var compileBlacklist = function () {
//  console.log("Recompiling onBlacklist");
  onBlacklist = buildMatchFn(options.user_blacklist);
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
  console.log(tabid + ": update_gui", state);
  if( state===undefined ) {
    console.log("Background: TRYING TO UPDATE ON NON-TRACKED PAGE");
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


// set up the hooks we want to listen upon
function init_listeners() {

  // install hook so we know when user starts loading a new page
  // (called after http redirects have been handled)
  chrome.webNavigation.onCommitted.addListener(function(details) {
    if(details.frameId != 0)
      return;
    // ignore generated transitions (eg due to chrome instant)
    if(details.transitionType == 'generated')
      return;

//    console.log("onCommitted tabid=", details.tabId, "url=",details.url, "transitionType=", details.transitionType);
    // attach our state tracker to the tab
    var state = new UnsourcedState( details.url,
      function (state) {update_gui(details.tabId, state);}
    );
    TabTracker[details.tabId] = state;


    // if site is whitelisted (and not blacklisted), start a lookup immediately
    if(!onBlacklist(details.url) && onWhitelist(details.url)) {
      console.log(details.tabId +": new page, permitted: ", details.url);
      state.startLookup();
    } else {
      console.log(details.tabId, ": new page, blocked: ", details.url);
    }
  });


  chrome.extension.onMessage.addListener( function(req, sender, sendResponse) {
    var state = TabTracker[sender.tab.id];
    if( state === undefined )
      return; // we're not covering this page
    console.log( "background.js: received "+ req.method + " from tab "+sender.tab.id);
    if(req.method == "pageExamined") {
      state.domReady(req.pageDetails);

      // was a lookup started earlier?
      if(state.lookupState=='none') {
        // no. but we know more now we've peeked at the page contents.
        // so maybe a lookup is now appropriate...
        if( state.pageDetails.isDefinitelyArticle == true ) {
          if( !onBlacklist(state.url)) {
            console.log("not blacklisted.", state.url);
            state.startLookup();
          } else {
            console.log("blacklisted.");
          }
        }
      }
    }
  });



  chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    if( TabTracker[tabId] !== undefined ) {
      delete TabTracker[tabId];
    }
  });

}


//
function storeOptions(new_options) {
  for (key in new_options) {
    options[key] = new_options[key];
  }
  console.log("save options: ", options);
  chrome.storage.sync.set(options);

  // perform any processing the changes require
  if( 'user_whitelist' in new_options ) {
    compileWhitelist();
  }
  if( 'user_blacklist' in new_options ) {
    compileBlacklist();
  }

}


function startup() {
  var default_options = {
    'search_server':'http://unsourced.org',
    'debug': false,
    'user_whitelist': [],
    'user_blacklist': []
  };

  chrome.storage.sync.get(default_options, function(items) {
    options = items;

    console.log("options upon startup: ", options);

    // continue startup
    compileWhitelist();
    compileBlacklist();
    init_listeners();
    console.log("F.A.B.");

  });
}
  
startup();



