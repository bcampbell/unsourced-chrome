
var defaultOptions = {
    sites: [
        "www.google.com/hostednews/...",
        "www.reuters.com",
        "hosted.ap.org",
        ".nytimes.com",
        "www.washingtonpost.com",
        "www.washingtontimes.com",
        "www.ft.com",
        "www.economist.com",
        "www.bbc.co.uk/news/...",
        "news.nationalgeographic.com/news/...",
        "www.theglobeandmail.com",
        "news.sky.com",
        "www.voanews.com",
        "www.wnd.com",
        "www.guardian.co.uk",
        "www.dailymail.co.uk",
        "www.telegraph.co.uk",
        "www.prnewswire.com",
        "www.pcmag.com",
        "www.theatlantic.com",
        "online.wsj.com",
        ".usatoday.com",
        "www.usnews.com/news/...",
        "www.latimes.com",
        "latimesblogs.latimes.com",
        ".sfgate.com",
        "www.nj.com/news/...",
        "www.mercurynews.com",
        "www.nypost.com",
        "www.nydailynews.com",
        "www.denverpost.com",
        "www.freep.com",
        "www.jsonline.com",
        "www.chicagotribune.com",
        ".cnn.com",
        ".time.com",
        ".starbulletin.com",
        "www.miamiherald.com",
        "www.startribune.com",
        "www.newsday.com",
        "www.azcentral.com",
        "www.thestar.com",
        "www.chron.com",
        "www.suntimes.com",
        "www.dallasnews.com",
        "www.mcclatchydc.com",
        "www.boston.com",
        "www.bostonherald.com",
        "www.scientificamerican.com",
        "www.sciencemag.org",
        "www.newscientist.com",
        "www.npr.org",
        "www.techcrunch.com",
        "www.cbc.ca/news/...",
        "www.newsmax.com",
        "www.breitbart.com",
        ".politico.com",
        "thehill.com",
        ".rollcall.com",
        ".talkingpointsmemo.com",
        "www.bloomberg.com",
        ".businessweek.com",
        "www.forbes.com",
        "www.csmonitor.com",
        "timesofindia.indiatimes.com",
        ".aljazeera.com",
        "www.theage.com.au",
        "news.smh.com.au",
        "news.yahoo.com",
        ".yahoo.com/news/...",
        "news.cnet.com",
        "www.cnbc.com",
        ".cbsnews.com",
        "abcnews.go.com",
        ".msnbc.msn.com",
        ".foxnews.com",
        ".huffingtonpost.com"
    ],
    include_local_news: true,
    use_generic_news_pattern: false,
    submit_urls: true,
    search_server: "http://localhost:8888"
  //search_server: "http://unsourced.org"
};


var LocalNews = [];

var options = defaultOptions;


/* associative array holding tab states and details retreived from unsourced.org
 * indexed by tabid.
 *
 * There are two processes happening in parallel:
 *  1) the normal loading of the web page
 *  2) the lookup request to unsourced.org
 *
 * the lookup is initiated as early as possible - before the page is ready to be
 * displayed to the user. We need both processes to finish before we can show
 * label overlays or popup windows, so all the progress is handled by
 * updateTabstate(), which invokes the displaying when conditions are right.
 *
 * TabTracker is accessed directly by popup window to grab the details downloaded
 * about the article
 */  
TabTracker = {};


function updateTabState(tabid, values) {
  if(TabTracker[tabid] === undefined) {
    TabTracker[tabid] = {lookup: '', dom: '', artDetails: {}};
  }
  var state = TabTracker[tabid];

  var before = {dom: state.dom, lookup: state.lookup};

  for( var v in values ) {
    state[v] = values[v];
  }


  /* perform any side effects resulting from this state change */
  console.log( "tab " + tabid + " state change: " + before.lookup +"," + before.dom + " => " + state.lookup + "," + state.dom);
  if(state.lookup=='done' && state.dom=='completed') {
    if(before.lookup!='done' || before.dom!='completed') {
      // both the unsourced.org lookup and the page itself are ready.
      // thunderbirds are go!
      show_results(tabid, state.artDetails);
    }
  }
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


function is_news_article(url) {
  var loc = parseUri(url);

  // don't check front page
  if (loc.path == '/')
     return;

  if (onWhitelist({'host': loc.host, 'pathname': loc.path})) {
    return true;
  } else {
    return false;
  }
}

var saveOptions = function (options){
    localStorage.setItem("options",JSON.stringify(options));
    compileWhitelist();
    return options;
};

var restoreOptions = function (){
    var options=JSON.parse(localStorage.getItem("options"));
    return (options==null)?resetOptions():options;
};

var resetOptions = function (){
    localStorage.setItem("options",JSON.stringify(defaultOptions));
    return defaultOptions;
};

var onWhitelist = function (location) {
    // This function is replaced by compileWhitelist
    return false;
};

var compileWhitelist = function () {
    console.log("Recompiling onWhitelist");

    var options = restoreOptions();
    var sites = options.sites;

    /* TODO: KILL? */
    if (options.include_local_news == true) {
        for (var idx = 0; idx < LocalNews.length; idx++) {
            var s = LocalNews[idx];
            if (sites.indexOf(s) == -1) {
                sites.push(s);
            }
        }
    }

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

    if (options.use_generic_news_pattern == true) {
        matchers.push(function(loc){
            return /(news|article)/i.test(loc.host + loc.pathname);
        });
    }

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


/* */
function show_results(tabid, details) {
    if(details.status=='found') {
       var title = details.sources.length + " sources, " + details.labels.length + " labels";
       chrome.pageAction.setIcon({'tabId': tabid, 'path': "/img/icon.png"});
       chrome.pageAction.setTitle({'tabId': tabid, 'title': title});
    } else {
        chrome.pageAction.setIcon({'tabId': tabid, 'path': "/img/icon_off.png"});
    }
    chrome.pageAction.setPopup({'tabId': tabid, 'popup': "/html/popup.html"});
    chrome.pageAction.show(tabid);

    console.log("Inject content stuff into tab", tabid);
    /* inject the extra content scripts and css into the page */
    chrome.tabs.insertCSS(tabid, {file: "/css/unsourced.css"});
    executeScriptsSynchronously(tabid, ["/js/lib/jquery.js", "/js/content.js"],
        function() {

        /* pass the article details in to the content script to present */
        var req = {
           'method': 'augmentArticle',
           'artDetails': details, 
        };
        chrome.tabs.sendRequest(tabid, req);
        console.log("Req sent to tab ",tabid, req);
      });
}



function doLookup(tabid,url) {
  var search_url = options.search_server + '/api/lookup?' + $.param({'url':url});
  console.log("doLookup(",tabid,url,")");

  updateTabState(tabid, {lookup:'pending'});

  $.ajax({
    type: "GET",
    url: search_url,
    dataType: 'json',
    success: function(result) {
      console.log("Success:", result);
      /* store the fetched article details until the page is ready for them */
      updateTabState(tabid, {lookup:'done', artDetails:result});
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("Error:", jqXHR, textStatus, errorThrown);
      updateTabState(tabid, {lookup:'failed'});
    }
  });
}


chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId != 0)
      return;

  var tabid = details.tabId;

  if(is_news_article(details.url)) {
    updateTabState(tabid,{dom:'committed'}); 
    doLookup(details.tabId, details.url);
  }
});


//chrome.webNavigation.onCompleted.addListener(function(details) {
chrome.webNavigation.onDOMContentLoaded.addListener(function(details) {
  if (details.frameId != 0)
      return;
  var tabid = details.tabId;
  if( TabTracker[tabid] === undefined )
      return;   /* not a news page */
  updateTabState(tabid,{dom:'completed'}); 
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if( TabTracker[tabId] !== undefined ) {
    delete TabTracker[tabId];
  }
});

compileWhitelist();

console.log("F.A.B.");

